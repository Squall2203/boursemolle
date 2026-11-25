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
    ALL_FEATURES, MIN_MARKET_CAP_USD, US_STRATEGY_SIZE, MODEL_CARD_PATH,
)
from features import (
    build_pit_financials, load_price_frame, compute_momentum_features,
    valuation_features, raw_price_before, rank_features, sic_to_division,
)
from edgar_download import load_all_sub, download_ticker_map

log = logging.getLogger(__name__)

MODEL_PATH = MODEL_DIR / "lgbm_model.pkl"
SHAP_PATH = MODEL_DIR / "shap_values.parquet"


FEATURE_LABELS = {
    "mom_1m": "performance sur un mois", "mom_3m": "performance sur trois mois",
    "mom_6m": "performance sur six mois", "mom_12m": "performance sur un an",
    "mom_12m_skip1m": "performance sur un an (hors dernier mois)",
    "vol_20d": "volatilité récente", "price_vs_sma200": "cours par rapport à sa moyenne de 200 séances",
    "price_vs_sma50": "cours par rapport à sa moyenne de 50 séances",
    "earnings_yield": "bénéfices rapportés au prix", "book_to_price": "actif net rapporté au prix",
    "sales_to_price": "ventes rapportées au prix", "fcf_yield": "trésorerie dégagée rapportée au prix",
    "gp_margin": "marge brute", "op_margin": "marge opérationnelle", "net_margin": "marge nette",
    "roe": "rentabilité des capitaux propres", "roa": "rentabilité de l'actif",
    "rev_growth_yoy": "croissance des ventes", "ni_growth_yoy": "croissance du bénéfice",
    "debt_to_equity": "endettement", "current_ratio": "liquidité à court terme",
    "cash_to_assets": "trésorerie", "fcf_margin": "trésorerie dégagée sur les ventes",
    "asset_turnover": "rotation de l'actif", "rd_intensity": "effort de recherche",
    "sic_div": "secteur d'activité",
}


def generate_justification(shap_contribs: dict[str, float], ranks: dict) -> str:
    """
    Phrase d'explication : les variables qui ont le plus poussé la note à la hausse, avec la place de
    l'action dans l'univers pour chacune (« parmi les 10 % les plus élevées »).
    """
    top = [(f, c) for f, c in sorted(shap_contribs.items(), key=lambda x: x[1], reverse=True) if c > 0][:3]
    parts = []
    for feat, _ in top:
        label = FEATURE_LABELS.get(feat, feat)
        rank = ranks.get(feat)
        if feat == "sic_div" or rank is None or pd.isna(rank):
            parts.append(label)
        elif rank >= 0.5:
            parts.append(f"{label} parmi les {max(1, round((1 - rank) * 100))} % les plus élevées")
        else:
            parts.append(f"{label} parmi les {max(1, round(rank * 100))} % les plus basses")
    if not parts:
        return "Aucune variable ne se détache : profil moyen sur l'ensemble des critères."
    return "Ce qui a le plus pesé dans le classement du modèle : " + " ; ".join(parts) + "."


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

    # Comptes publiés les plus récents, connus à ce jour
    today = date.today()
    sub = load_all_sub()
    cik_to_ticker = download_ticker_map()
    fund_df = build_pit_financials(sub, None, cik_to_ticker, [today], only_tickers=set(us_tickers))
    log.info(f"Got EDGAR features for {len(fund_df)} tickers")
    fund_by_ticker = {r["ticker"]: r for r in fund_df.to_dict("records")} if not fund_df.empty else {}

    # Mêmes variables qu'à l'entraînement, calculées de la même façon : comptes publiés, cours du modèle
    rows = []
    for ticker in us_tickers:
        frame = load_price_frame(ticker)
        rec = fund_by_ticker.get(ticker)
        if frame is None and rec is None:
            continue
        row = {"ticker": ticker, "rebalancing_date": today, **{f: np.nan for f in ALL_FEATURES}}
        if rec is not None:
            row.update(rec)
            row["sic_div"] = sic_to_division(rec.get("sic"))
        else:
            row["sic_div"] = -1
        if frame is not None:
            dates_ns, adj, raw = frame
            row.update(compute_momentum_features(ticker, (dates_ns, adj), today))
            row.update(valuation_features(rec or {}, raw_price_before(dates_ns, raw, today)))
        rows.append(row)

    if not rows:
        log.error("No features generated for current US universe")
        return []

    df = pd.DataFrame(rows)

    # Garde-fou : on écarte les actions en chute libre (plus de 35 % de baisse en six mois)
    n_before = len(df)
    df = df[df["mom_6m"].isna() | (df["mom_6m"] > -35)].reset_index(drop=True)
    log.info(f"Quality gate: {n_before - len(df)} stocks excluded, {len(df)} remaining")

    # Passage en rangs, comme à l'entraînement. Les valeurs absentes restent absentes : le modèle sait les traiter.
    df = rank_features(df, by=None)
    X = df[ALL_FEATURES].astype("float64")

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

    # Note de toutes les actions américaines évaluées. Elle est publiée dans us_predictions.json, que
    # l'ingestion relit pour renseigner mlScore : écrire directement dans stocks.json ne servait à rien,
    # ce fichier n'était pas commité par cette tâche et l'ingestion suivante l'écrasait.
    global _LAST_SCORES
    _LAST_SCORES = {
        t: round(float(sc), 1) for t, sc in zip(df["ticker"].tolist(), df["score_normalized"].tolist())
    }

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
            "justification": generate_justification(shap_contribs, row.to_dict()),
            "weight": round(1 / US_STRATEGY_SIZE, 4),
            "isNew": False,      # populated by alphapicks.ts comparison
            "pe": stock.get("trailingPE"),
            "roe": stock.get("returnOnEquity"),
            "perf6M": stock.get("perf6M"),
            "divYield": stock.get("dividendYield"),
            "marketCap": stock.get("marketCap"),
            "price": stock.get("price"),
            "peaEligible": False,
            # Rangs (0 à 10) de l'action dans l'univers noté, par famille de variables
            "pillars": {
                "valorisation": _pillar_from_percentile(row.get("earnings_yield")),
                "qualite": _pillar_from_percentile(row.get("roe")),
                "croissance": _pillar_from_percentile(row.get("rev_growth_yoy")),
                "sante": _pillar_from_percentile(row.get("current_ratio")),
                "dividende": min(10.0, (stock.get("dividendYield") or 0) * 2),
                "momentum": _pillar_from_percentile(row.get("mom_12m_skip1m")),
            },
        }
        picks.append(pick)

    return picks


def _pillar_from_percentile(pct: float) -> float:
    """Convert a 0-1 percentile to a 0-10 score."""
    if pct is None or pd.isna(pct):
        return 5.0
    return round(float(pct) * 10, 1)


_LAST_SCORES: dict[str, float] = {}


def write_predictions(picks: list[dict]):
    """Write the picks and the score of every evaluated US stock to public/data/picks/us_predictions.json."""
    period = date.today().strftime("%Y-%m")
    model = joblib.load(MODEL_PATH)

    # Évaluation du modèle sur le passé. Sans elle, ou si elle n'est pas concluante, les sélections sont
    # tout de même écrites (pour suivi), mais marquées non validées : le site ne les publie pas.
    card = json.loads(MODEL_CARD_PATH.read_text()) if MODEL_CARD_PATH.exists() else None
    validated = bool(card and card.get("validated"))
    if not validated:
        reasons = card["failed_criteria"] if card else ["aucune évaluation disponible pour ce modèle"]
        log.warning("Modèle non validé, sélections non publiées : " + " ; ".join(reasons))

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "period": period,
        "validated": validated,
        "backtest": card,
        "engine": "lightgbm_v1",
        "model": {
            "n_estimators": int(model.n_estimators_),
            "features": ALL_FEATURES,
            "n_picks": US_STRATEGY_SIZE,
        },
        "picks": picks,
        "scores": _LAST_SCORES,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
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
