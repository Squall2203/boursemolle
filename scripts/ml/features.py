"""
Point-in-Time feature engineering for the AlphaPicks ML pipeline.

« Point-in-Time » : à chaque date de sélection, on n'utilise que ce qui était public ce jour-là
(dernier rapport déposé à la SEC, cours jusqu'à la veille au soir). Aucune donnée du futur.
"""
import logging
import json
from datetime import date

import numpy as np
import pandas as pd
from tqdm import tqdm

from config import (
    EDGAR_DIR, PRICES_DIR, ML_PRICES_DIR, DATA_DIR,
    TAG_MAP, MOMENTUM_FEATURES, VALUATION_FEATURES, RANKED_FEATURES, ALL_FEATURES,
    FORWARD_DAYS, REBALANCE_MONTHS,
)
from edgar_download import load_all_sub, download_ticker_map

log = logging.getLogger(__name__)

FEATURES_PATH = DATA_DIR / "features.parquet"

# Écart maximal toléré entre la date de sélection et la première séance cotée qui la suit (week-ends, jours fériés)
MAX_ENTRY_GAP_NS = np.int64(7 * 24 * 3600 * 1_000_000_000)

# Un rapport plus ancien que cela n'est plus considéré comme une information à jour sur l'entreprise
MAX_FILING_AGE_DAYS = 200

# ─── EDGAR data extraction ────────────────────────────────────────────────────

def get_tag_value(num_for_filing, concept, qtrs_filter=None):
    """Valeur la plus récente d'un poste comptable dans un rapport, ou None."""
    if num_for_filing is None or num_for_filing.empty:
        return None
    for tag in TAG_MAP.get(concept, []):
        rows = num_for_filing[num_for_filing["tag"] == tag]
        if qtrs_filter is not None:
            rows = rows[rows["qtrs"].isin(qtrs_filter)]
        if rows.empty:
            continue
        rows = rows.sort_values("ddate", ascending=False)
        val = rows.iloc[0]["value"]
        if pd.notna(val):
            return float(val)
    return None


def load_num_for_filings(adsh_set: set) -> pd.DataFrame:
    """
    Charge les valeurs comptables des seuls rapports utiles, trimestre par trimestre.
    Tout charger d'un bloc (plusieurs dizaines de millions de lignes) est lent et gourmand en mémoire.
    """
    files = sorted(EDGAR_DIR.glob("*_num.parquet"))
    if not files:
        raise FileNotFoundError("No EDGAR data found. Run: python pipeline.py --download")
    parts = []
    for f in tqdm(files, desc="EDGAR num"):
        part = pd.read_parquet(f)
        parts.append(part[part["adsh"].isin(adsh_set)])
    num = pd.concat(parts, ignore_index=True)
    num["qtrs"] = num["qtrs"].astype("Int64")
    return num


def _safe_div(a, b, scale=1.0):
    if a is None or b is None or b == 0:
        return np.nan
    return (a / b) * scale


def _safe_growth(curr, prev):
    if curr is None or prev is None or prev <= 0:
        return np.nan
    return (curr / prev - 1) * 100


def _filing_record(filing, num_rows, ya_num):
    """
    Variables tirées d'un rapport (et du rapport de la même période un an plus tôt).

    Un rapport annuel (10-K) donne des montants sur douze mois, un rapport trimestriel (10-Q) sur trois.
    Les montants trimestriels sont multipliés par quatre avant d'être rapportés à un stock (capitaux
    propres, actif, capitalisation) : sinon la rentabilité d'une même société varierait du simple au
    quadruple selon le type de son dernier rapport.
    """
    flow_q = 4 if "10-K" in str(filing["form"]) else 1
    annual = 4 / flow_q

    def flow(concept, rows=num_rows):
        return get_tag_value(rows, concept, qtrs_filter=[flow_q])

    rev, gp, op_inc, net_inc = flow("revenue"), flow("gross_profit"), flow("operating_income"), flow("net_income")
    rd, eps = flow("rd_expense"), flow("eps_diluted")

    assets      = get_tag_value(num_rows, "total_assets",        qtrs_filter=[0])
    curr_assets = get_tag_value(num_rows, "current_assets",      qtrs_filter=[0])
    curr_liab   = get_tag_value(num_rows, "current_liabilities", qtrs_filter=[0])
    equity      = get_tag_value(num_rows, "total_equity",        qtrs_filter=[0])
    ltd         = get_tag_value(num_rows, "long_term_debt",      qtrs_filter=[0])
    cash        = get_tag_value(num_rows, "cash",                qtrs_filter=[0])
    shares      = get_tag_value(num_rows, "shares_outstanding")

    # Les flux de trésorerie d'un rapport trimestriel sont cumulés depuis le début de l'exercice
    # (trois, six ou neuf mois). On prend le cumul le plus long disponible et on le ramène à l'année.
    fcf_ann = None
    for q in ([4] if flow_q == 4 else [3, 2, 1]):
        op_cf = get_tag_value(num_rows, "operating_cf", qtrs_filter=[q])
        if op_cf is None:
            continue
        capex = get_tag_value(num_rows, "capex", qtrs_filter=[q])
        fcf_ann = (op_cf - capex if capex is not None else op_cf) * 4 / q
        break

    rev_ya = flow("revenue", ya_num) if ya_num is not None else None
    ni_ya  = flow("net_income", ya_num) if ya_num is not None else None

    def ann(v):
        return None if v is None else v * annual

    return {
        "sic": int(filing["sic"]) if pd.notna(filing.get("sic")) else None,
        "filed_date": filing["filed"].date(),
        "period_end": filing["period"].date() if pd.notna(filing["period"]) else None,
        # Montants annualisés, gardés pour calculer la valorisation une fois le cours connu
        "_revenue_ann": ann(rev), "_net_income_ann": ann(net_inc), "_fcf_ann": fcf_ann,
        "_eps_ann": ann(eps), "_equity": equity, "_shares": shares,
        "gp_margin":      _safe_div(gp,      rev, 100),
        "op_margin":      _safe_div(op_inc,  rev, 100),
        "net_margin":     _safe_div(net_inc, rev, 100),
        "fcf_margin":     _safe_div(fcf_ann, ann(rev), 100),
        "rd_intensity":   _safe_div(rd,      rev, 100),
        "roe":            _safe_div(ann(net_inc), equity, 100),
        "roa":            _safe_div(ann(net_inc), assets, 100),
        "asset_turnover": _safe_div(ann(rev),     assets),
        "rev_growth_yoy": _safe_growth(rev, rev_ya),
        "ni_growth_yoy":  _safe_growth(net_inc, ni_ya),
        "debt_to_equity": _safe_div(ltd,         equity, 100),
        "current_ratio":  _safe_div(curr_assets, curr_liab),
        "cash_to_assets": _safe_div(cash,        assets, 100),
    }


def _year_ago_filing(ticker_sub, filing):
    """
    Rapport de même nature (annuel ou trimestriel) portant sur la même période un an plus tôt.
    Comparer un trimestre à une année entière donnerait une « croissance » de −75 %.
    """
    if pd.isna(filing["period"]):
        return None
    is_annual = "10-K" in str(filing["form"])
    same_kind = ticker_sub[ticker_sub["form"].str.contains("10-K").astype(bool) == is_annual]
    target = filing["period"] - pd.DateOffset(years=1)
    gap = (same_kind["period"] - target).abs()
    candidates = same_kind[(gap <= pd.Timedelta(days=20)) & (same_kind["filed"] < filing["filed"])]
    if candidates.empty:
        return None
    return candidates.sort_values("filed").iloc[-1]


def build_pit_financials(sub, num, cik_to_ticker, rebalancing_dates, only_tickers=None):
    sub = sub[sub["form"].isin(["10-K", "10-Q", "10-K/A", "10-Q/A"])].copy()
    sub["cik"] = sub["cik"].astype("Int64")
    sub["ticker"] = sub["cik"].map(cik_to_ticker)
    sub = sub.dropna(subset=["ticker"])
    if only_tickers is not None:
        # Une société sans historique de cours n'a ni momentum ni rendement futur : elle ne peut pas
        # servir à l'entraînement. L'écarter ici évite de traiter des milliers de sociétés pour rien.
        sub = sub[sub["ticker"].isin(only_tickers)]
    if num is None:
        num = load_num_for_filings(set(sub["adsh"]))
    num_by_adsh = {adsh: grp for adsh, grp in num.groupby("adsh")}

    records = []
    tickers = sorted(sub["ticker"].unique())
    log.info(f"Building PIT financials for {len(tickers)} tickers x {len(rebalancing_dates)} dates")

    for ticker in tqdm(tickers, desc="Tickers"):
        ticker_sub = sub[sub["ticker"] == ticker].sort_values("filed")
        cik = int(ticker_sub.iloc[0]["cik"])
        filed = ticker_sub["filed"].values.astype("datetime64[ns]")
        # Un même rapport reste le plus récent pendant plusieurs dates de sélection : calculé une seule fois
        cache: dict[str, dict | None] = {}

        for reb_date in rebalancing_dates:
            reb_ts = pd.Timestamp(reb_date)
            # « left » : un rapport déposé le jour même n'est pas encore exploitable
            idx = int(np.searchsorted(filed, reb_ts.to_datetime64(), side="left"))
            if idx == 0:
                continue
            latest = ticker_sub.iloc[idx - 1]
            if (reb_ts - latest["filed"]).days > MAX_FILING_AGE_DAYS:
                continue
            adsh = latest["adsh"]
            if adsh not in cache:
                num_rows = num_by_adsh.get(adsh)
                if num_rows is None or num_rows.empty:
                    cache[adsh] = None
                else:
                    ya = _year_ago_filing(ticker_sub, latest)
                    ya_num = num_by_adsh.get(ya["adsh"]) if ya is not None else None
                    cache[adsh] = _filing_record(latest, num_rows, ya_num)
            rec = cache[adsh]
            if rec is None:
                continue
            records.append({"ticker": ticker, "cik": cik, "rebalancing_date": reb_date, **rec})

    return pd.DataFrame(records)


# ─── Price loading ────────────────────────────────────────────────────────────

def load_price_frame(ticker: str):
    """
    Retourne (dates_ns, adj, raw) ou None.
      adj : cours corrigé des divisions et des dividendes (rendements, momentum)
      raw : cours réellement coté (valorisation)
    Lit l'historique long du modèle ; à défaut, le fichier de cours du site (cinq ans, sans correction).
    """
    p = ML_PRICES_DIR / f"{ticker}.parquet"
    try:
        if p.exists():
            df = pd.read_parquet(p)
            df["date"] = pd.to_datetime(df["date"])
            adj_col, raw_col = "adjclose", "raw_close"
        else:
            pj = PRICES_DIR / f"{ticker}.json"
            if not pj.exists():
                return None
            candles = json.loads(pj.read_text(encoding="utf-8", errors="replace")).get("candles", [])
            if not candles:
                return None
            df = pd.DataFrame(candles)[["date", "close"]]
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            adj_col = raw_col = "close"
        df = df.dropna(subset=["date", adj_col]).sort_values("date").drop_duplicates(subset=["date"], keep="last")
        if df.empty:
            return None
        # Conversion explicite en nanosecondes : depuis pandas 3, les dates n'ont plus d'unité fixe, alors
        # que tout le pipeline compare à Timestamp.value (nanosecondes). Sans cela, aucune date de
        # sélection ne retombe dans l'historique et aucun rendement n'est calculé.
        dates_ns = df["date"].values.astype("datetime64[ns]").astype("int64")
        return dates_ns, df[adj_col].values.astype("float64"), df[raw_col].values.astype("float64")
    except Exception as e:
        log.warning(f"Failed to load prices for {ticker}: {e}")
        return None


def load_price_series(ticker: str):
    """Retourne (dates_ns, cours corrigés) ou None."""
    frame = load_price_frame(ticker)
    return None if frame is None else (frame[0], frame[1])


def available_price_tickers() -> set:
    tickers = {p.stem for p in ML_PRICES_DIR.glob("*.parquet")}
    for p in PRICES_DIR.glob("*.json"):
        tickers.add(p.stem[1:] if p.stem.startswith("_") else p.stem)
    return tickers


def _ts_ns(d) -> np.int64:
    return np.int64(pd.Timestamp(d).value)


# ─── Momentum features — numpy pur ───────────────────────────────────────────

def compute_momentum_bulk(dates_ns, prices, reb_dates):
    """Variables de cours à chaque date, calculées sur les séances strictement antérieures."""
    nan = np.nan
    results = []
    for reb_date in reb_dates:
        # « left » : la séance du jour de sélection n'est pas utilisée, son cours de clôture
        # n'est pas encore connu au moment de choisir.
        idx = int(np.searchsorted(dates_ns, _ts_ns(reb_date), side="left"))
        if idx == 0:
            results.append({f: nan for f in MOMENTUM_FEATURES})
            continue
        hist = prices[:idx]
        n    = len(hist)

        def ret(days_back, skip=0):
            ei = n - 1 - skip
            si = ei - days_back
            if si < 0 or ei < 0: return nan
            p_e, p_s = hist[ei], hist[si]
            if not np.isfinite(p_s) or p_s <= 0: return nan
            return (p_e / p_s - 1.0) * 100.0

        feats = {
            "mom_1m":         ret(21),
            "mom_3m":         ret(63),
            "mom_6m":         ret(126),
            "mom_12m":        ret(252),
            "mom_12m_skip1m": ret(231, skip=21),
        }
        if n >= 22:
            window = hist[max(0, n-22):]
            dr = np.diff(window) / window[:-1]
            dr = dr[np.isfinite(dr)]
            feats["vol_20d"] = float(np.std(dr) * np.sqrt(252) * 100) if len(dr) > 1 else nan
        else:
            feats["vol_20d"] = nan
        feats["price_vs_sma200"] = (hist[-1] / hist[max(0,n-200):].mean() - 1)*100 if n >= 200 else nan
        feats["price_vs_sma50"]  = (hist[-1] / hist[max(0,n-50):].mean()  - 1)*100 if n >= 50  else nan
        results.append(feats)
    return results


def compute_momentum_features(ticker: str, price_series, ref_date) -> dict:
    """Single-date wrapper around compute_momentum_bulk for the predict step."""
    dates_ns, prices = price_series
    results = compute_momentum_bulk(dates_ns, prices, [ref_date])
    if results:
        return results[0]
    return {f: np.nan for f in MOMENTUM_FEATURES}


# ─── Valorisation ─────────────────────────────────────────────────────────────

def raw_price_before(dates_ns, raw, ref_date):
    """Dernier cours réellement coté avant la date de sélection, ou None."""
    idx = int(np.searchsorted(dates_ns, _ts_ns(ref_date), side="left"))
    if idx == 0:
        return None
    # Un cours trop ancien (cotation suspendue, historique troué) ne dit rien du prix du jour
    if _ts_ns(ref_date) - dates_ns[idx - 1] > MAX_ENTRY_GAP_NS:
        return None
    price = float(raw[idx - 1])
    return price if np.isfinite(price) and price > 0 else None


def valuation_features(rec: dict, price) -> dict:
    """Comptes publiés rapportés au cours du jour. Les valeurs sont en pourcentage du prix."""
    out = {f: np.nan for f in VALUATION_FEATURES}
    if price is None:
        return out

    def val(key):
        v = rec.get(key)
        return None if v is None or (isinstance(v, float) and np.isnan(v)) else float(v)

    shares = val("_shares")
    mcap = shares * price if shares and shares > 0 else None
    eps = val("_eps_ann")
    # Le bénéfice par action est publié directement : plus fiable que bénéfice / nombre d'actions
    # pour les sociétés à plusieurs classes d'actions.
    if eps is not None:
        out["earnings_yield"] = eps / price * 100
    elif mcap:
        out["earnings_yield"] = _safe_div(val("_net_income_ann"), mcap, 100)
    if mcap:
        out["book_to_price"]  = _safe_div(val("_equity"),      mcap, 100)
        out["sales_to_price"] = _safe_div(val("_revenue_ann"), mcap, 100)
        out["fcf_yield"]      = _safe_div(val("_fcf_ann"),     mcap, 100)
    return out


# ─── Forward label computation ────────────────────────────────────────────────

def compute_forward_returns(tickers, rebalancing_dates, forward_days=FORWARD_DAYS):
    records = []
    log.info(f"Computing forward returns over {forward_days} sessions...")
    for ticker in tqdm(tickers, desc="Forward returns"):
        data = load_price_series(ticker)
        if data is None:
            continue
        dates_ns, prices = data
        for reb_date in rebalancing_dates:
            ts_ns = _ts_ns(reb_date)
            # Une date de sélection antérieure au début de l'historique n'a pas de cours d'entrée :
            # sans ce test, elle recevait le rendement des premières séances connues, donc une
            # étiquette fausse, répétée à l'identique pour toutes les dates trop anciennes.
            if ts_ns < dates_ns[0] - MAX_ENTRY_GAP_NS:
                continue
            idx_entry = int(np.searchsorted(dates_ns, ts_ns, side="left"))
            idx_exit  = idx_entry + forward_days
            if idx_entry >= len(prices) or idx_exit >= len(prices):
                continue
            # Même garde-fou en cas de trou dans l'historique (cotation suspendue, données manquantes)
            if dates_ns[idx_entry] - ts_ns > MAX_ENTRY_GAP_NS:
                continue
            entry_price = prices[idx_entry]
            exit_price  = prices[idx_exit]
            if not np.isfinite(entry_price) or entry_price <= 0 or not np.isfinite(exit_price):
                continue
            records.append({
                "ticker": ticker,
                "rebalancing_date": reb_date,
                "fwd_return": (exit_price / entry_price - 1) * 100,
            })
    return pd.DataFrame(records)


def add_targets(df: pd.DataFrame, min_names: int = 30) -> pd.DataFrame:
    """
    Ajoute, par date : l'écart au rendement moyen de l'univers (fwd_return_rel) et la cible
    d'entraînement (target), le rang du rendement parmi les actions de la même date, de −0,5 à +0,5.
    Apprendre un rang plutôt qu'un rendement évite qu'une poignée d'actions ayant doublé en trois mois
    dicte à elles seules ce que le modèle retient.
    """
    grp = df.groupby("rebalancing_date")["fwd_return"]
    df["fwd_return_rel"] = df["fwd_return"] - grp.transform("mean")
    df["target"] = grp.rank(pct=True) - 0.5
    # Une date avec trop peu d'actions notées ne permet pas de classer : elle ne sert pas à l'entraînement
    counts = grp.transform("count")
    df.loc[counts < min_names, ["target", "fwd_return_rel"]] = np.nan
    return df


def sic_to_division(sic):
    if sic is None or (isinstance(sic, float) and np.isnan(sic)): return -1
    if sic < 1000:    return 0
    elif sic < 2000:  return 1
    elif sic < 4000:  return 2
    elif sic < 5000:  return 3
    elif sic < 6000:  return 4
    elif sic < 7000:  return 5
    elif sic < 8000:  return 6
    elif sic < 9000:  return 7
    else:             return 8


def rank_features(df: pd.DataFrame, by: str | None = "rebalancing_date") -> pd.DataFrame:
    """
    Remplace chaque variable par son rang parmi les actions de la même date (0 à 1).
    Le modèle compare ainsi les actions entre elles un jour donné, sans dépendre du niveau général du
    marché cette année-là. Les valeurs absentes restent absentes.
    """
    out = df.copy()
    for col in RANKED_FEATURES:
        values = out[col].astype("float64")
        out[col] = values.groupby(out[by]).rank(pct=True) if by else values.rank(pct=True)
    out["sic_div"] = out["sic_div"].astype("float64")
    return out


def _build_rebalancing_dates(start_year, end_year, max_filed):
    dates = []
    for year in range(int(start_year) + 1, end_year + 1):
        for month in REBALANCE_MONTHS:
            dates.append(date(year, month, 2))
    return [d for d in dates if pd.Timestamp(d) <= max_filed]


# ─── Main ─────────────────────────────────────────────────────────────────────

def build_feature_dataset(force: bool = False) -> pd.DataFrame:
    if FEATURES_PATH.exists() and not force:
        log.info(f"Loading cached features from {FEATURES_PATH}")
        return pd.read_parquet(FEATURES_PATH)

    us_tickers = {p.stem for p in ML_PRICES_DIR.glob("*.parquet")} or available_price_tickers()
    log.info(f"Price history available: {len(us_tickers)} tickers")

    # ── Etape 1 : comptes publiés ────────────────────────────────────────────
    sub = load_all_sub()
    cik_to_ticker = download_ticker_map()
    rebalancing_dates = _build_rebalancing_dates(sub["filed"].dt.year.min(), date.today().year, sub["filed"].max())
    log.info(f"Rebalancing dates: {rebalancing_dates[0]} -> {rebalancing_dates[-1]} ({len(rebalancing_dates)} periods)")

    df = build_pit_financials(sub, None, cik_to_ticker, rebalancing_dates, only_tickers=us_tickers)
    if df.empty:
        raise RuntimeError("Aucun compte publié n'a pu être rattaché aux actions de l'univers.")
    df["sic_div"] = df["sic"].apply(sic_to_division)
    log.info(f"Fundamental features: {len(df):,} rows, {df['ticker'].nunique()} tickers")

    # ── Etape 2 : cours (momentum et valorisation) ───────────────────────────
    log.info("Adding momentum and valuation features...")
    extra = []
    for ticker, group in tqdm(df.groupby("ticker"), desc="Prices"):
        frame = load_price_frame(ticker)
        if frame is None:
            continue
        dates_ns, adj, raw = frame
        rows = group.to_dict("records")
        mom = compute_momentum_bulk(dates_ns, adj, [r["rebalancing_date"] for r in rows])
        for row, feats in zip(rows, mom):
            price = raw_price_before(dates_ns, raw, row["rebalancing_date"])
            extra.append({
                "ticker": ticker, "rebalancing_date": row["rebalancing_date"],
                **feats, **valuation_features(row, price),
            })
    if extra:
        df = df.merge(pd.DataFrame(extra), on=["ticker", "rebalancing_date"], how="left")
    for col in MOMENTUM_FEATURES + VALUATION_FEATURES:
        if col not in df.columns:
            df[col] = np.nan

    # ── Etape 3 : rendements futurs ──────────────────────────────────────────
    fwd_df = compute_forward_returns(sorted(df["ticker"].unique()), rebalancing_dates)
    if fwd_df.empty:
        df["fwd_return"] = np.nan
    else:
        df = df.merge(fwd_df, on=["ticker", "rebalancing_date"], how="left")
    df = add_targets(df)

    n_labeled = int(df["target"].notna().sum())
    log.info(f"Feature dataset: {n_labeled:,} rows with labels, {len(df):,} total, "
             f"{df.loc[df['target'].notna(), 'rebalancing_date'].nunique()} labeled dates")
    if n_labeled == 0:
        # Sans rendement futur calculé, il n'y a rien à apprendre : on s'arrête ici avec un message clair
        # plutôt que de laisser l'entraînement planter plus loin sur un jeu vide.
        raise RuntimeError(
            "Aucun rendement futur n'a pu être calculé : vérifier que l'historique de cours du modèle "
            "a bien été téléchargé (python pipeline.py --download) et que ses dates sont lisibles."
        )
    coverage = {f: round(float(df[f].notna().mean()), 2) for f in ALL_FEATURES}
    log.info(f"Feature coverage: {coverage}")

    df.to_parquet(FEATURES_PATH, index=False)
    log.info(f"Saved to {FEATURES_PATH}")
    return df


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    args = p.parse_args()
    df = build_feature_dataset(force=args.force)
    print(df[ALL_FEATURES + ["fwd_return_rel"]].describe())
