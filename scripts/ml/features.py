"""
Point-in-Time feature engineering for the AlphaPicks ML pipeline.
"""
import logging
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

from config import (
    EDGAR_DIR, PRICES_DIR, STOCKS_JSON, DATA_DIR,
    TAG_MAP, FUNDAMENTAL_FEATURES, MOMENTUM_FEATURES, ALL_FEATURES,
    MIN_MARKET_CAP_USD, FORWARD_DAYS,
)
from edgar_download import load_all_sub, load_all_num, download_ticker_map

log = logging.getLogger(__name__)

FEATURES_PATH       = DATA_DIR / "features.parquet"
FUNDAMENTALS_PATH   = DATA_DIR / "fundamentals.parquet"   # cache EDGAR permanent
CHECKPOINT_PATH     = DATA_DIR / "features_checkpoint.parquet"
MOMENTUM_CHECKPOINT = DATA_DIR / "momentum_checkpoint.parquet"

# ─── EDGAR data extraction ────────────────────────────────────────────────────

def get_tag_value(num_for_filing, concept, qtrs_filter=None):
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


def build_pit_financials(sub, num, cik_to_ticker, rebalancing_dates,
                         checkpoint_path=None, done_tickers=None):
    sub = sub[sub["form"].isin(["10-K", "10-Q", "10-K/A", "10-Q/A"])].copy()
    sub["cik"] = sub["cik"].astype("Int64")
    sub["ticker"] = sub["cik"].map(cik_to_ticker)
    sub = sub.dropna(subset=["ticker"])
    num_by_adsh = {adsh: grp for adsh, grp in num.groupby("adsh")}

    records = []
    tickers = sorted(sub["ticker"].unique())
    if done_tickers:
        tickers = [t for t in tickers if t not in done_tickers]
    log.info(f"Building PIT financials for {len(tickers)} tickers x {len(rebalancing_dates)} dates")

    for i, ticker in enumerate(tqdm(tickers, desc="Tickers")):
        ticker_sub = sub[sub["ticker"] == ticker].sort_values("filed")
        cik = ticker_sub.iloc[0]["cik"]

        for reb_date in rebalancing_dates:
            reb_ts = pd.Timestamp(reb_date)
            available = ticker_sub[ticker_sub["filed"] <= reb_ts]
            if available.empty:
                continue
            latest = available.iloc[-1]
            adsh = latest["adsh"]
            num_rows = num_by_adsh.get(adsh, pd.DataFrame())
            if num_rows.empty:
                continue

            year_ago_ts = reb_ts - pd.DateOffset(years=1)
            year_ago_available = ticker_sub[ticker_sub["filed"] <= year_ago_ts]
            year_ago_num = pd.DataFrame()
            if not year_ago_available.empty:
                ya_adsh = year_ago_available.iloc[-1]["adsh"]
                year_ago_num = num_by_adsh.get(ya_adsh, pd.DataFrame())

            rev     = get_tag_value(num_rows, "revenue",                qtrs_filter=[4, 1])
            gp      = get_tag_value(num_rows, "gross_profit",           qtrs_filter=[4, 1])
            op_inc  = get_tag_value(num_rows, "operating_income",       qtrs_filter=[4, 1])
            net_inc = get_tag_value(num_rows, "net_income",             qtrs_filter=[4, 1])
            assets  = get_tag_value(num_rows, "total_assets",           qtrs_filter=[0])
            curr_assets = get_tag_value(num_rows, "current_assets",     qtrs_filter=[0])
            curr_liab   = get_tag_value(num_rows, "current_liabilities",qtrs_filter=[0])
            equity  = get_tag_value(num_rows, "total_equity",           qtrs_filter=[0])
            ltd     = get_tag_value(num_rows, "long_term_debt",         qtrs_filter=[0])
            cash    = get_tag_value(num_rows, "cash",                   qtrs_filter=[0])
            op_cf   = get_tag_value(num_rows, "operating_cf",           qtrs_filter=[4, 1])
            capex   = get_tag_value(num_rows, "capex",                  qtrs_filter=[4, 1])
            rd      = get_tag_value(num_rows, "rd_expense",             qtrs_filter=[4, 1])
            rev_ya  = get_tag_value(year_ago_num, "revenue",    qtrs_filter=[4, 1]) if not year_ago_num.empty else None
            ni_ya   = get_tag_value(year_ago_num, "net_income", qtrs_filter=[4, 1]) if not year_ago_num.empty else None

            def safe_div(a, b, scale=1.0):
                if a is None or b is None or b == 0: return np.nan
                return (a / b) * scale

            def safe_growth(curr, prev):
                if curr is None or prev is None or prev <= 0: return np.nan
                return (curr / prev - 1) * 100

            records.append({
                "ticker": ticker, "cik": int(cik),
                "rebalancing_date": reb_date,
                "filed_date": latest["filed"].date(),
                "period_end": latest["period"].date() if pd.notna(latest["period"]) else None,
                "sic": int(latest["sic"]) if pd.notna(latest.get("sic")) else None,
                "_revenue": rev, "_net_income": net_inc, "_total_assets": assets,
                "gp_margin":      safe_div(gp,      rev,    100),
                "op_margin":      safe_div(op_inc,  rev,    100),
                "net_margin":     safe_div(net_inc, rev,    100),
                "roe":            safe_div(net_inc, equity, 100),
                "roa":            safe_div(net_inc, assets, 100),
                "asset_turnover": safe_div(rev,     assets),
                "rev_growth_yoy": safe_growth(rev,     rev_ya),
                "ni_growth_yoy":  safe_growth(net_inc, ni_ya),
                "debt_to_equity": safe_div(ltd,         equity, 100),
                "current_ratio":  safe_div(curr_assets, curr_liab),
                "cash_to_assets": safe_div(cash,        assets, 100),
                "fcf_margin": safe_div(
                    (op_cf - capex) if (op_cf is not None and capex is not None) else op_cf,
                    rev, 100),
                "rd_intensity": safe_div(rd, rev, 100),
            })

        if checkpoint_path and (i + 1) % 500 == 0:
            pd.DataFrame(records).to_parquet(checkpoint_path, index=False)
            log.info(f" Checkpoint saved ({i + 1}/{len(tickers)} tickers)")

    return pd.DataFrame(records)


# ─── Price loading ────────────────────────────────────────────────────────────

def load_price_series(ticker: str):
    """Retourne (dates_ns int64, prices float64) ou None."""
    p = PRICES_DIR / f"{ticker}.json"
    if not p.exists():
        return None
    try:
        raw = json.loads(p.read_text(encoding="utf-8", errors="replace"))
        candles = raw.get("candles", [])
        if not candles:
            return None
        df = pd.DataFrame(candles)[["date", "close"]]
        df["date"] = (
            pd.to_datetime(df["date"], format="mixed", dayfirst=False,
                           utc=True, errors="coerce")
            .dt.tz_localize(None)
        )
        df = df.dropna(subset=["date"])
        if df.empty:
            return None
        df = df.sort_values("date").drop_duplicates(subset=["date"], keep="last")
        return df["date"].values.astype("int64"), df["close"].values.astype("float64")
    except Exception as e:
        log.warning(f"Failed to load prices for {ticker}: {e}")
        return None


# ─── Momentum features — numpy pur ───────────────────────────────────────────

def compute_momentum_bulk(dates_ns, prices, reb_dates):
    nan = np.nan
    results = []
    for reb_date in reb_dates:
        ts_ns = np.int64(pd.Timestamp(reb_date).value)
        idx   = int(np.searchsorted(dates_ns, ts_ns, side="right"))
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


# ─── Forward label computation ────────────────────────────────────────────────

def compute_forward_returns(tickers, rebalancing_dates, forward_days=FORWARD_DAYS):
    records = []
    log.info("Computing forward returns...")
    for ticker in tqdm(tickers, desc="Forward returns"):
        data = load_price_series(ticker)
        if data is None:
            continue
        dates_ns, prices = data
        for reb_date in rebalancing_dates:
            ts_ns     = np.int64(pd.Timestamp(reb_date).value)
            idx_entry = int(np.searchsorted(dates_ns, ts_ns, side="left"))
            idx_exit  = idx_entry + forward_days
            if idx_entry >= len(prices) or idx_exit >= len(prices):
                continue
            entry_price = prices[idx_entry]
            exit_price  = prices[idx_exit]
            if entry_price <= 0:
                continue
            records.append({
                "ticker": ticker,
                "rebalancing_date": reb_date,
                "fwd_return": (exit_price / entry_price - 1) * 100,
            })
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df["fwd_return_rel"] = df.groupby("rebalancing_date")["fwd_return"].transform(
        lambda x: x - x.mean()
    )
    return df


# ─── Valuation ───────────────────────────────────────────────────────────────

def load_current_valuation():
    raw = json.loads(STOCKS_JSON.read_text())
    rows = []
    for s in raw.get("stocks", []):
        rows.append({
            "ticker": s["ticker"], "market_cap": s.get("marketCap"),
            "pe_ttm": s.get("trailingPE"), "pb_ratio": s.get("priceToBook"),
            "price": s.get("price"), "country": s.get("country"),
            "sector": s.get("sector"), "peaEligible": s.get("peaEligible", False),
        })
    return pd.DataFrame(rows)


def sic_to_division(sic):
    if sic is None:   return -1
    if sic < 1000:    return 0
    elif sic < 2000:  return 1
    elif sic < 4000:  return 2
    elif sic < 5000:  return 3
    elif sic < 6000:  return 4
    elif sic < 7000:  return 5
    elif sic < 8000:  return 6
    elif sic < 9000:  return 7
    else:             return 8


def _build_rebalancing_dates(start_year, end_year, max_filed):
    dates = []
    for year in range(int(start_year) + 1, end_year + 1):
        for month in [1, 4, 7, 10]:
            dates.append(date(year, month, 2))
    return [d for d in dates if pd.Timestamp(d) <= max_filed]


# ─── Main ─────────────────────────────────────────────────────────────────────

def build_feature_dataset(force: bool = False) -> pd.DataFrame:
    if FEATURES_PATH.exists() and not force:
        log.info(f"Loading cached features from {FEATURES_PATH}")
        return pd.read_parquet(FEATURES_PATH)

    # ── Etape 1 : fondamentaux EDGAR ─────────────────────────────────────────
    if FUNDAMENTALS_PATH.exists() and not force:
        log.info(f"Loading cached fundamentals from {FUNDAMENTALS_PATH}")
        fund_df = pd.read_parquet(FUNDAMENTALS_PATH)
        # Recalcule les dates de rebalancing depuis les donnees cachees
        min_year = fund_df["filed_date"].apply(lambda d: d.year).min()
        max_date = pd.Timestamp(fund_df["filed_date"].max())
        rebalancing_dates = _build_rebalancing_dates(min_year, date.today().year, max_date)
        log.info(f"Fundamental features: {len(fund_df):,} rows (cached) | "
                 f"Dates: {rebalancing_dates[0]} -> {rebalancing_dates[-1]}")
    else:
        # Charge les donnees EDGAR (long — ~15 min)
        checkpoint_df = None
        done_tickers: set = set()
        if CHECKPOINT_PATH.exists() and not force:
            checkpoint_df = pd.read_parquet(CHECKPOINT_PATH)
            done_tickers  = set(checkpoint_df["ticker"].unique())
            log.info(f"Resuming from checkpoint: {len(done_tickers)} tickers already done")
        else:
            log.info("Building PIT feature dataset from scratch...")

        sub = load_all_sub()
        num = load_all_num()
        cik_to_ticker = download_ticker_map()
        log.info(f"Loaded {len(sub):,} filings, {len(num):,} numeric values")

        rebalancing_dates = _build_rebalancing_dates(
            sub["filed"].dt.year.min(), date.today().year, sub["filed"].max()
        )
        log.info(f"Rebalancing dates: {rebalancing_dates[0]} -> {rebalancing_dates[-1]} "
                 f"({len(rebalancing_dates)} periods)")

        fund_df_new = build_pit_financials(
            sub, num, cik_to_ticker, rebalancing_dates,
            checkpoint_path=CHECKPOINT_PATH,
            done_tickers=done_tickers if done_tickers else None,
        )
        if checkpoint_df is not None and not checkpoint_df.empty:
            fund_df = pd.concat([checkpoint_df, fund_df_new], ignore_index=True)
        else:
            fund_df = fund_df_new

        fund_df["sic_div"] = fund_df["sic"].apply(sic_to_division)
        fund_df.to_parquet(FUNDAMENTALS_PATH, index=False)
        log.info(f"Fundamental features: {len(fund_df):,} rows — saved to {FUNDAMENTALS_PATH}")

        if CHECKPOINT_PATH.exists():
            CHECKPOINT_PATH.unlink()

    fund_df["sic_div"] = fund_df["sic"].apply(sic_to_division)

    # Pre-scan price files once — reused in étapes 2, 3 et 4
    available_price_tickers: set = set()
    for p in PRICES_DIR.glob("*.json"):
        stem = p.stem
        available_price_tickers.add(stem)
        if stem.startswith("_"):          # Windows reserved-name workaround (_CON.DE → CON.DE)
            available_price_tickers.add(stem[1:])
    log.info(f"Price files available: {len(available_price_tickers)} tickers")

    # ── Etape 2 : momentum features ──────────────────────────────────────────
    mom_done_tickers: set = set()
    mom_records_prev = []
    if MOMENTUM_CHECKPOINT.exists() and not force:
        mom_ckpt_df      = pd.read_parquet(MOMENTUM_CHECKPOINT)
        mom_done_tickers = set(mom_ckpt_df["ticker"].unique())
        mom_records_prev = mom_ckpt_df.to_dict("records")
        log.info(f"Resuming momentum from checkpoint: {len(mom_done_tickers)} tickers done")

    log.info("Adding momentum features...")
    grouped       = {t: g["rebalancing_date"].tolist() for t, g in fund_df.groupby("ticker")}
    all_tickers_m = sorted(grouped.keys())
    total_tickers = len(all_tickers_m)

    tickers_with_prices    = [t for t in all_tickers_m if t in available_price_tickers]
    tickers_without_prices = [t for t in all_tickers_m
                               if t not in available_price_tickers and t not in mom_done_tickers]

    log.info(f"  {len(tickers_with_prices)} tickers have price data, "
             f"{len(tickers_without_prices)} get NaN in bulk (no price file)")

    # Bulk-insert NaN rows for tickers with no price data — no per-file I/O
    nan_feats = {f: np.nan for f in MOMENTUM_FEATURES}
    mom_records = list(mom_records_prev)
    for ticker in tickers_without_prices:
        for rd in grouped[ticker]:
            mom_records.append({"ticker": ticker, "rebalancing_date": rd, **nan_feats})

    # Process only tickers with price files that aren't already in checkpoint
    tickers_to_process = [t for t in tickers_with_prices if t not in mom_done_tickers]
    log.info(f"  {len(tickers_to_process)} tickers to compute (after checkpoint exclusion)")

    pbar = tqdm(tickers_to_process, desc="Momentum", total=len(tickers_to_process))
    for i, ticker in enumerate(pbar):
        pbar.set_postfix({"t": ticker})
        try:
            data      = load_price_series(ticker)
            reb_dates = grouped[ticker]
            if data is None:
                for rd in reb_dates:
                    mom_records.append({"ticker": ticker, "rebalancing_date": rd, **nan_feats})
            else:
                dates_ns, prices = data
                bulk = compute_momentum_bulk(dates_ns, prices, reb_dates)
                for rd, feats in zip(reb_dates, bulk):
                    mom_records.append({"ticker": ticker, "rebalancing_date": rd, **feats})
        except Exception as e:
            log.warning(f"Skipping {ticker} (momentum error): {e}")
            for rd in grouped[ticker]:
                mom_records.append({"ticker": ticker, "rebalancing_date": rd, **nan_feats})

        if (i + 1) % 200 == 0:
            pd.DataFrame(mom_records).to_parquet(MOMENTUM_CHECKPOINT, index=False)
            log.info(f" Momentum checkpoint saved ({i + 1}/{len(tickers_to_process)} tickers)")

    mom_df = pd.DataFrame(mom_records)
    df = fund_df.merge(mom_df, on=["ticker", "rebalancing_date"], how="left")

    # ── Etape 3 : P/E approx ─────────────────────────────────────────────────
    log.info("Approximating historical P/E from price and EPS...")
    pe_records = []
    for ticker, group in tqdm(
        df[df["ticker"].isin(available_price_tickers)].groupby("ticker"),
        desc="P/E approx",
    ):
        data = load_price_series(ticker)
        for _, row in group.iterrows():
            price = None
            if data is not None:
                dates_ns, prices = data
                ts_ns = np.int64(pd.Timestamp(row["rebalancing_date"]).value)
                idx   = int(np.searchsorted(dates_ns, ts_ns, side="right"))
                if idx > 0:
                    price = float(prices[idx - 1])
            pe_records.append({
                "ticker": ticker,
                "rebalancing_date": row["rebalancing_date"],
                "_price_at_date": price,
            })
    pe_df = pd.DataFrame(pe_records)
    df = df.merge(pe_df, on=["ticker", "rebalancing_date"], how="left")
    df["pe_ttm"]   = np.nan
    df["pb_ratio"] = np.nan

    # ── Etape 4 : forward returns ─────────────────────────────────────────────
    fwd_tickers = [t for t in df["ticker"].unique() if t in available_price_tickers]
    fwd_df = compute_forward_returns(fwd_tickers, rebalancing_dates)
    if not fwd_df.empty:
        df = df.merge(
            fwd_df[["ticker", "rebalancing_date", "fwd_return", "fwd_return_rel"]],
            on=["ticker", "rebalancing_date"], how="left",
        )
    else:
        df["fwd_return"]     = np.nan
        df["fwd_return_rel"] = np.nan

    log.info(f"Feature dataset: {len(df.dropna(subset=['fwd_return_rel'])):,} rows with labels, {len(df):,} total")
    df.to_parquet(FEATURES_PATH, index=False)
    if MOMENTUM_CHECKPOINT.exists():
        MOMENTUM_CHECKPOINT.unlink()
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
