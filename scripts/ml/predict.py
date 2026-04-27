"""
Generate current-month ML predictions for the AlphaPicks US strategy.

Loads the trained LightGBM model + SHAP values and scores the current
universe of US stocks using the most recent available EDGAR data.

Output: public/data/picks/us_predictions.json
  {
    "generatedAt": "2026-05-01T07:00:00Z",
    "period": "2026-05",
    "model": { "n_estimators": 423, "features": [...] },
    "picks": [
      {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "score": 8.7,            // normalized 0-10
        "ml_score": 0.342,       // raw model output
        "shap": {                // top-3 feature contributions
          "mom_12m_skip1m": 0.12,
          "op_margin": 0.09,
          "roe": 0.07"
        },
        "justification": "...",
        // standard pick fields
        "pe": 38.2, "roe": 45.1, "perf6M": 24.3, ...
      }
    ]
  }
"""
import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from config import (
    MODEL_DIR, DATA_DIR, STOCKS_JSON, OUTPUT_JSON, PRICES_DIR,
    ALL_FEATURES, FUNDAMENTAL_FEATURES, MIN_MARKET_CAP_USD, US_STRATEGY_SIZE,
)
from features import (
    build_feature_dataset, load_price_series, compute_momentum_features,
    sic_to_division,
)
from edgar_download import load_all_sub, load_all_num, download_ticker_map
from features import build_pit_financials

log = logging.getLogger(__name__)

MODEL_PATH = MODEL_DIR / "lgbm_model.pkl"
SHAP_PATH = MODEL_DIR / "shap_values.parquet"


def generate_justification(
    ticker: str,
    shap_contribs: dict[str, float],
    stock_data: dict,
) -> str:
    """Generate human-readable justification from top SHAP contributors."""
    # Sort by absolute contribution
    top = sorted(shap_contribs.items(), key=lambda x: abs(x[1]), reverse=True)[:3]

    parts = []
    for feat, contrib in top:
        if abs(contrib) < 0.005:
            continue
        direction = "fort" if contrib > 0 else "faible"

        if feat == "mom_12m_skip1m":
            val = stock_data.get("perf1Y")
            parts.append(
                f"Momentum 12M exceptionnel (+{val:.0f}%)" if val and val > 0
                else "Momentum 12M favorable"
            )
        elif feat == "op_margin":
            val = stock_data.get("operatingMargins")
            parts.append(
                f"Marge opérationnelle {direction} ({val*100:.1f}%)" if val else f"Marge opérationnelle {direction}"
            )
        elif feat == "roe":
            val = stock_data.get("returnOnEquity")
            parts.append(
                f"ROE {direction} ({val*100:.0f}%)" if val else f"Rentabilité des fonds propres {direction}"
            )
        elif feat == "rev_growth_yoy":
            val = stock_data.get("revenueGrowth")
            parts.append(
                f"Croissance du CA de {val*100:.0f}% en glissement annuel" if val else "Croissance du chiffre d'affaires solide"
            )
        elif feat == "net_margin":
            parts.append(f"Marge nette {direction}")
        elif feat == "fcf_margin":
            parts.append(f"Génération de cash-flow libre {direction}")
        elif feat == "debt_to_equity":
            parts.append(f"Levier financier {'maîtrisé' if contrib > 0 else 'élevé'}")
        elif feat == "vol_20d":
            parts.append(f"Volatilité {'faible' if contrib > 0 else 'élevée'} à 20 jours")
        elif feat == "price_vs_sma200":
            parts.append(f"Cours {'au-dessus' if contrib > 0 else 'en-dessous'} de la SMA 200")
        elif feat == "gp_margin":
            parts.append(f"Marge brute {direction}")
        elif feat == "current_ratio":
            parts.append(f"Liquidité {direction}")
        else:
            parts.append(f"{feat.replace('_', ' ').capitalize()} {direction}")

    if not parts:
        return "Profil ML favorable sur l'ensemble des critères quantitatifs."

    result = parts[0]
    if len(parts) > 1:
        result += f". {parts[1]}"
    result += " — sélection algorithmique LightGBM."
    return result


def predict_current(force_features: bool = False) -> list[dict]:
    """
    Score current US universe using trained model.
    Returns list of picks sorted by ML score descending.
    """
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"No model found at {MODEL_PATH}. Run train.py first.")

    model = joblib.load(MODEL_PATH)
    log.info(f"Model loaded: {model.n_estimators_} trees, {len(ALL_FEATURES)} features")

    # Load current stocks universe
    raw = json.loads(STOCKS_JSON.read_text())
    all_stocks = {s["ticker"]: s for s in raw.get("stocks", [])}

    # Filter to US stocks above market cap threshold
    us_tickers = [
        t for t, s in all_stocks.items()
        if s.get("country") in ("United States",)
        and s.get("marketCap") is not None
        and s["marketCap"] >= MIN_MARKET_CAP_USD
        and s.get("price") is not None
    ]
    log.info(f"US universe: {len(us_tickers)} stocks above ${MIN_MARKET_CAP_USD/1e9:.0f}B market cap")

    # Get EDGAR PIT features for today
    today = date.today()
    sub = load_all_sub()
    num = load_all_num()
    cik_to_ticker = download_ticker_map()
    ticker_to_cik = {v: k for k, v in cik_to_ticker.items()}

    # Filter sub to only our US tickers
    us_ciks = {ticker_to_cik[t] for t in us_tickers if t in ticker_to_cik}
    sub_us = sub[sub["cik"].isin(us_ciks)]
    num_us = num[num["adsh"].isin(sub_us["adsh"])]

    fund_df = build_pit_financials(sub_us, num_us, cik_to_ticker, [today])
    log.info(f"Got EDGAR features for {len(fund_df)} tickers")

    # Add momentum features
    rows = []
    for _, row in fund_df.iterrows():
        ticker = row["ticker"]
        ps = load_price_series(ticker)
        if ps is None:
            mom_feats = {f: np.nan for f in [
                "mom_1m", "mom_3m", "mom_6m", "mom_12m", "mom_12m_skip1m",
                "vol_20d", "price_vs_sma200", "price_vs_sma50"
            ]}
        else:
            mom_feats = compute_momentum_features(ticker, ps, today)

        stock = all_stocks.get(ticker, {})
        rows.append({
            **row.to_dict(),
            **mom_feats,
            "sic_div": sic_to_division(row.get("sic")),
            "pe_ttm": stock.get("trailingPE"),
            "pb_ratio": stock.get("priceToBook"),
        })

    if not rows:
        log.error("No features generated for current US universe")
        return []

    df = pd.DataFrame(rows)

    # Add tickers with price data but no EDGAR (use momentum-only features)
    tickers_with_edgar = set(df["ticker"].tolist())
    for ticker in us_tickers:
        if ticker in tickers_with_edgar:
            continue
        ps = load_price_series(ticker)
        if ps is None:
            continue
        mom_feats = compute_momentum_features(ticker, ps, today)
        stock = all_stocks.get(ticker, {})
        row = {
            "ticker": ticker,
            "rebalancing_date": today,
            "sic": None,
            "sic_div": -1,
            "pe_ttm": stock.get("trailingPE"),
            "pb_ratio": stock.get("priceToBook"),
            **{f: np.nan for f in FUNDAMENTAL_FEATURES if f not in ["pe_ttm", "pb_ratio"]},
            **mom_feats,
        }
        for f in ALL_FEATURES:
            if f not in row:
                row[f] = np.nan
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)

    # Rank-normalize fundamental features (cross-sectional, same as training)
    for col in FUNDAMENTAL_FEATURES:
        if col in df.columns:
            df[col] = df[col].rank(pct=True)

    X = df[ALL_FEATURES].fillna(0.5)

    # Raw ML scores
    raw_scores = model.predict(X)
    df["ml_score"] = raw_scores

    # Normalize to 0-10 scale using percentile rank
    ranks = pd.Series(raw_scores).rank(pct=True)
    df["score_normalized"] = (ranks * 10).round(1)

    # SHAP explanations
    log.info("Computing SHAP values for current picks...")
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X)
    shap_df = pd.DataFrame(shap_vals, columns=ALL_FEATURES)
    df["shap_idx"] = range(len(df))

    # Sort by ML score
    df = df.sort_values("ml_score", ascending=False).reset_index(drop=True)

    # Build picks output
    picks = []
    for rank, (_, row) in enumerate(df.head(US_STRATEGY_SIZE).iterrows(), start=1):
        ticker = row["ticker"]
        stock = all_stocks.get(ticker, {})

        shap_row = shap_df.iloc[int(row["shap_idx"])]
        # Top SHAP contributions (by absolute value)
        shap_contribs = dict(shap_row.nlargest(5))

        pick = {
            "ticker": ticker,
            "name": stock.get("name", ticker),
            "sector": stock.get("sector"),
            "country": stock.get("country", "United States"),
            "currency": stock.get("currency", "USD"),
            "rank": rank,
            "score": float(row["score_normalized"]),
            "ml_score": round(float(row["ml_score"]), 4),
            "shap_top": {k: round(float(v), 4) for k, v in shap_contribs.items()},
            "justification": generate_justification(ticker, shap_contribs, stock),
            "weight": round(1 / US_STRATEGY_SIZE, 4),
            "isNew": False,      # populated by alphapicks.ts comparison
            "pe": stock.get("trailingPE"),
            "roe": stock.get("returnOnEquity"),
            "perf6M": stock.get("perf6M"),
            "divYield": stock.get("dividendYield"),
            "marketCap": stock.get("marketCap"),
            "price": stock.get("price"),
            "peaEligible": False,
            "pillars": {
                "valorisation": _pillar_from_percentile(1 - df["pe_ttm"].rank(pct=True).iloc[rank - 1]),
                "qualite": _pillar_from_percentile(df["roe"].rank(pct=True).iloc[rank - 1] if "roe" in df else 0.5),
                "croissance": _pillar_from_percentile(df["rev_growth_yoy"].rank(pct=True).iloc[rank - 1] if "rev_growth_yoy" in df else 0.5),
                "sante": _pillar_from_percentile(df["current_ratio"].rank(pct=True).iloc[rank - 1] if "current_ratio" in df else 0.5),
                "dividende": min(10.0, (stock.get("dividendYield") or 0) * 2),
                "momentum": _pillar_from_percentile(df["mom_12m_skip1m"].rank(pct=True).iloc[rank - 1] if "mom_12m_skip1m" in df else 0.5),
            },
        }
        picks.append(pick)

    return picks


def _pillar_from_percentile(pct: float) -> float:
    """Convert a 0-1 percentile to a 0-10 score."""
    if pd.isna(pct):
        return 5.0
    return round(float(pct) * 10, 1)


def write_predictions(picks: list[dict]):
    """Write predictions to public/data/picks/us_predictions.json."""
    period = date.today().strftime("%Y-%m")
    model = joblib.load(MODEL_PATH)

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "period": period,
        "engine": "lightgbm_v1",
        "model": {
            "n_estimators": int(model.n_estimators_),
            "features": ALL_FEATURES,
            "n_picks": US_STRATEGY_SIZE,
        },
        "picks": picks,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    # Write to a separate file (us_predictions.json) not latest.json
    pred_path = OUTPUT_JSON.parent / "us_predictions.json"
    pred_path.write_text(json.dumps(output, indent=2))
    log.info(f"Saved {len(picks)} picks to {pred_path}")


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--force-features", action="store_true")
    args = p.parse_args()
    picks = predict_current(force_features=args.force_features)
    write_predictions(picks)
    print(f"\nTop 5 picks:")
    for pick in picks[:5]:
        print(f"  {pick['rank']}. {pick['ticker']} ({pick['name']}) — score {pick['score']:.1f}")
        print(f"     {pick['justification']}")
