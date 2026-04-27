"""
Point-in-Time feature engineering for the AlphaPicks ML pipeline.

PIT constraint: for any rebalancing date T, we only use financial data
from filings where sub.filed <= T. This is the only legally available
information at time T — no lookahead bias.

Output: a DataFrame indexed by (ticker, rebalancing_date) with:
  - Fundamental features (from EDGAR, PIT-constrained)
  - Momentum features (from our local price history)
  - Forward label: relative 1-month return vs equal-weight universe
"""
import logging
import json
from datetime import date, timedelta
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

FEATURES_PATH = DATA_DIR / "features.parquet"


# ─── EDGAR data extraction ────────────────────────────────────────────────────

def get_tag_value(
    num_for_filing: pd.DataFrame,
    concept: str,
    qtrs_filter: list[int] | None = None,
) -> float | None:
    """
    Extract a financial value from num rows for a single filing.
    Tries tags in priority order from TAG_MAP[concept].
    qtrs_filter: if provided, only return rows where qtrs is in this list.
      0 = balance sheet (instant), 1 = quarterly, 4 = annual
    """
    for tag in TAG_MAP.get(concept, []):
        rows = num_for_filing[num_for_filing["tag"] == tag]
        if qtrs_filter is not None:
            rows = rows[rows["qtrs"].isin(qtrs_filter)]
        if rows.empty:
            continue
        # Take the most recent period
        rows = rows.sort_values("ddate", ascending=False)
        val = rows.iloc[0]["value"]
        if pd.notna(val):
            return float(val)
    return None


def build_pit_financials(
    sub: pd.DataFrame,
    num: pd.DataFrame,
    cik_to_ticker: dict[int, str],
    rebalancing_dates: list[date],
) -> pd.DataFrame:
    """
    For each (ticker, rebalancing_date), extract the most recently filed
    financials as of that date. Returns a DataFrame with one row per combo.
    """
    # Filter to 10-K and 10-Q
    sub = sub[sub["form"].isin(["10-K", "10-Q", "10-K/A", "10-Q/A"])].copy()
    sub["cik"] = sub["cik"].astype("Int64")

    # Add ticker
    sub["ticker"] = sub["cik"].map(cik_to_ticker)
    sub = sub.dropna(subset=["ticker"])

    # Build num index by adsh for fast lookup
    num_by_adsh = {adsh: grp for adsh, grp in num.groupby("adsh")}

    records = []
    tickers = sorted(sub["ticker"].unique())
    log.info(f"Building PIT financials for {len(tickers)} tickers × {len(rebalancing_dates)} dates")

    for ticker in tqdm(tickers, desc="Tickers"):
        ticker_sub = sub[sub["ticker"] == ticker].sort_values("filed")
        cik = ticker_sub.iloc[0]["cik"]

        for reb_date in rebalancing_dates:
            reb_ts = pd.Timestamp(reb_date)

            # PIT constraint: only filings submitted before rebalancing date
            available = ticker_sub[ticker_sub["filed"] <= reb_ts]
            if available.empty:
                continue

            # Most recent filing as of this date
            latest = available.iloc[-1]
            adsh = latest["adsh"]
            num_rows = num_by_adsh.get(adsh, pd.DataFrame())

            if num_rows.empty:
                continue

            # Also get the year-ago filing for YoY growth
            year_ago_ts = reb_ts - pd.DateOffset(years=1)
            year_ago_available = ticker_sub[ticker_sub["filed"] <= year_ago_ts]
            year_ago_num = pd.DataFrame()
            if not year_ago_available.empty:
                ya_adsh = year_ago_available.iloc[-1]["adsh"]
                year_ago_num = num_by_adsh.get(ya_adsh, pd.DataFrame())

            # ── Extract balance sheet (qtrs=0, instant values) ──
            rev = get_tag_value(num_rows, "revenue", qtrs_filter=[4, 1])
            gp = get_tag_value(num_rows, "gross_profit", qtrs_filter=[4, 1])
            op_inc = get_tag_value(num_rows, "operating_income", qtrs_filter=[4, 1])
            net_inc = get_tag_value(num_rows, "net_income", qtrs_filter=[4, 1])
            assets = get_tag_value(num_rows, "total_assets", qtrs_filter=[0])
            curr_assets = get_tag_value(num_rows, "current_assets", qtrs_filter=[0])
            curr_liab = get_tag_value(num_rows, "current_liabilities", qtrs_filter=[0])
            equity = get_tag_value(num_rows, "total_equity", qtrs_filter=[0])
            ltd = get_tag_value(num_rows, "long_term_debt", qtrs_filter=[0])
            cash = get_tag_value(num_rows, "cash", qtrs_filter=[0])
            op_cf = get_tag_value(num_rows, "operating_cf", qtrs_filter=[4, 1])
            capex = get_tag_value(num_rows, "capex", qtrs_filter=[4, 1])
            rd = get_tag_value(num_rows, "rd_expense", qtrs_filter=[4, 1])

            # YoY growth
            rev_ya = get_tag_value(year_ago_num, "revenue", qtrs_filter=[4, 1]) if not year_ago_num.empty else None
            ni_ya = get_tag_value(year_ago_num, "net_income", qtrs_filter=[4, 1]) if not year_ago_num.empty else None

            # ── Compute ratios ──
            def safe_div(a, b, scale=1.0):
                if a is None or b is None or b == 0:
                    return np.nan
                return (a / b) * scale

            def safe_growth(curr, prev):
                if curr is None or prev is None or prev <= 0:
                    return np.nan
                return (curr / prev - 1) * 100

            rec = {
                "ticker": ticker,
                "cik": int(cik),
                "rebalancing_date": reb_date,
                "filed_date": latest["filed"].date(),
                "period_end": latest["period"].date() if pd.notna(latest["period"]) else None,
                "sic": int(latest["sic"]) if pd.notna(latest.get("sic")) else None,
                # Raw values (scaled to millions for numerical stability)
                "_revenue": rev,
                "_net_income": net_inc,
                "_total_assets": assets,
                # Margin ratios (%)
                "gp_margin": safe_div(gp, rev, 100),
                "op_margin": safe_div(op_inc, rev, 100),
                "net_margin": safe_div(net_inc, rev, 100),
                # Profitability
                "roe": safe_div(net_inc, equity, 100),
                "roa": safe_div(net_inc, assets, 100),
                "asset_turnover": safe_div(rev, assets),
                # Growth (%)
                "rev_growth_yoy": safe_growth(rev, rev_ya),
                "ni_growth_yoy": safe_growth(net_inc, ni_ya),
                # Leverage & liquidity
                "debt_to_equity": safe_div(ltd, equity, 100),
                "current_ratio": safe_div(curr_assets, curr_liab),
                "cash_to_assets": safe_div(cash, assets, 100),
                # Cash flow
                "fcf_margin": safe_div(
                    (op_cf - capex) if (op_cf is not None and capex is not None) else op_cf,
                    rev, 100
                ),
                # R&D intensity
                "rd_intensity": safe_div(rd, rev, 100),
            }
            records.append(rec)

    return pd.DataFrame(records)


# ─── Price / momentum features ────────────────────────────────────────────────

def load_price_series(ticker: str) -> pd.Series | None:
    """Load adjusted close prices as a date-indexed Series."""
    p = PRICES_DIR / f"{ticker}.json"
    if not p.exists():
        return None
    try:
        raw = json.loads(p.read_text())
        candles = raw.get("candles", [])
        if not candles:
            return None
        df = pd.DataFrame(candles)[["date", "close"]]
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date")["close"].sort_index()
        return df
    except Exception:
        return None


def compute_momentum_features(
    ticker: str,
    price_series: pd.Series,
    reb_date: date,
) -> dict:
    """Compute price momentum features as of reb_date using only past prices."""
    ts = pd.Timestamp(reb_date)
    hist = price_series[price_series.index <= ts]
    if hist.empty:
        return {}

    def ret(days_back: int, skip_days: int = 0) -> float | None:
        end_idx = len(hist) - 1 - skip_days
        start_idx = end_idx - days_back
        if start_idx < 0 or end_idx < 0:
            return None
        p_end = hist.iloc[end_idx]
        p_start = hist.iloc[start_idx]
        if p_start <= 0:
            return None
        return (p_end / p_start - 1) * 100

    feats: dict = {}
    feats["mom_1m"] = ret(21)
    feats["mom_3m"] = ret(63)
    feats["mom_6m"] = ret(126)
    feats["mom_12m"] = ret(252)
    feats["mom_12m_skip1m"] = ret(252 - 21, skip_days=21)  # classic momentum

    # Volatility
    if len(hist) >= 22:
        daily_rets = hist.pct_change().dropna().iloc[-21:]
        feats["vol_20d"] = float(daily_rets.std() * np.sqrt(252) * 100)
    else:
        feats["vol_20d"] = np.nan

    # Trend
    if len(hist) >= 200:
        sma200 = hist.iloc[-200:].mean()
        current = hist.iloc[-1]
        feats["price_vs_sma200"] = (current / sma200 - 1) * 100
    else:
        feats["price_vs_sma200"] = np.nan

    if len(hist) >= 50:
        sma50 = hist.iloc[-50:].mean()
        current = hist.iloc[-1]
        feats["price_vs_sma50"] = (current / sma50 - 1) * 100
    else:
        feats["price_vs_sma50"] = np.nan

    return feats


# ─── Forward label computation ────────────────────────────────────────────────

def compute_forward_returns(
    tickers: list[str],
    rebalancing_dates: list[date],
    forward_days: int = FORWARD_DAYS,
) -> pd.DataFrame:
    """
    Compute forward returns for each (ticker, date).
    Label = relative return vs equal-weight universe (market-neutral).
    """
    records = []
    price_cache: dict[str, pd.Series] = {}

    log.info("Computing forward returns...")
    for ticker in tqdm(tickers, desc="Forward returns"):
        if ticker not in price_cache:
            ps = load_price_series(ticker)
            if ps is None:
                continue
            price_cache[ticker] = ps

        ps = price_cache[ticker]
        for reb_date in rebalancing_dates:
            ts_entry = pd.Timestamp(reb_date)
            # Entry: first trading day at or after reb_date
            entry_prices = ps[ps.index >= ts_entry]
            if entry_prices.empty:
                continue
            entry_price = entry_prices.iloc[0]
            entry_date = entry_prices.index[0]

            # Exit: forward_days trading days later
            exit_candidates = ps[ps.index > entry_date]
            if len(exit_candidates) < forward_days:
                continue
            exit_price = exit_candidates.iloc[forward_days - 1]

            if entry_price <= 0:
                continue

            fwd_ret = (exit_price / entry_price - 1) * 100
            records.append({"ticker": ticker, "rebalancing_date": reb_date, "fwd_return": fwd_ret})

    df = pd.DataFrame(records)
    if df.empty:
        return df

    # Market-neutralize: subtract cross-sectional mean per date
    df["fwd_return_rel"] = df.groupby("rebalancing_date")["fwd_return"].transform(
        lambda x: x - x.mean()
    )
    return df


# ─── Valuation from stocks.json ───────────────────────────────────────────────

def load_current_valuation() -> pd.DataFrame:
    """
    Load current P/E, P/B, market cap from stocks.json.
    These are used for scoring current picks only (not historical training).
    """
    raw = json.loads(STOCKS_JSON.read_text())
    rows = []
    for s in raw.get("stocks", []):
        rows.append({
            "ticker": s["ticker"],
            "market_cap": s.get("marketCap"),
            "pe_ttm": s.get("trailingPE"),
            "pb_ratio": s.get("priceToBook"),
            "price": s.get("price"),
            "country": s.get("country"),
            "sector": s.get("sector"),
            "peaEligible": s.get("peaEligible", False),
        })
    return pd.DataFrame(rows)


# ─── SIC → sector encoding ────────────────────────────────────────────────────

def sic_to_division(sic: int | None) -> int:
    """Map SIC code to a broad sector division (0-9)."""
    if sic is None:
        return -1
    if sic < 1000:
        return 0   # Agriculture, Forestry, Fishing
    elif sic < 2000:
        return 1   # Mining
    elif sic < 4000:
        return 2   # Manufacturing
    elif sic < 5000:
        return 3   # Transportation, Communications, Electric, Gas
    elif sic < 6000:
        return 4   # Wholesale Trade
    elif sic < 7000:
        return 5   # Retail Trade
    elif sic < 8000:
        return 6   # Finance, Insurance, Real Estate
    elif sic < 9000:
        return 7   # Services
    else:
        return 8   # Public Administration


# ─── Main feature building function ───────────────────────────────────────────

def build_feature_dataset(force: bool = False) -> pd.DataFrame:
    """
    Build the full PIT feature dataset. Saves to data/features.parquet.

    Returns DataFrame indexed by (ticker, rebalancing_date) with all features + labels.
    """
    if FEATURES_PATH.exists() and not force:
        log.info(f"Loading cached features from {FEATURES_PATH}")
        return pd.read_parquet(FEATURES_PATH)

    log.info("Building PIT feature dataset from scratch...")

    # Load raw EDGAR data
    sub = load_all_sub()
    num = load_all_num()
    cik_to_ticker = download_ticker_map()
    log.info(f"Loaded {len(sub):,} filings, {len(num):,} numeric values")

    # Define rebalancing dates: first trading day of each quarter
    # We use Jan 2, Apr 1, Jul 1, Oct 1 as approximations
    start_year = sub["filed"].dt.year.min()
    end_year = date.today().year
    rebalancing_dates: list[date] = []
    for year in range(int(start_year) + 1, end_year + 1):
        for month in [1, 4, 7, 10]:
            rebalancing_dates.append(date(year, month, 2))

    # Filter to dates we have EDGAR data for
    max_filed = sub["filed"].max()
    rebalancing_dates = [d for d in rebalancing_dates if pd.Timestamp(d) <= max_filed]
    log.info(f"Rebalancing dates: {rebalancing_dates[0]} → {rebalancing_dates[-1]} ({len(rebalancing_dates)} periods)")

    # Build PIT fundamental features
    fund_df = build_pit_financials(sub, num, cik_to_ticker, rebalancing_dates)
    log.info(f"Fundamental features: {len(fund_df):,} rows")

    # Add SIC division
    fund_df["sic_div"] = fund_df["sic"].apply(sic_to_division)

    # Add momentum features
    log.info("Adding momentum features...")
    price_cache: dict[str, pd.Series] = {}
    mom_records = []

    for _, row in tqdm(fund_df.iterrows(), total=len(fund_df), desc="Momentum"):
        ticker = row["ticker"]
        reb_date = row["rebalancing_date"]

        if ticker not in price_cache:
            price_cache[ticker] = load_price_series(ticker)

        ps = price_cache[ticker]
        if ps is None:
            mom_feats = {f: np.nan for f in MOMENTUM_FEATURES}
        else:
            mom_feats = compute_momentum_features(ticker, ps, reb_date)

        mom_records.append({"ticker": ticker, "rebalancing_date": reb_date, **mom_feats})

    mom_df = pd.DataFrame(mom_records)
    df = fund_df.merge(mom_df, on=["ticker", "rebalancing_date"], how="left")

    # Load valuation from stocks.json for P/E, P/B (current only, not historical)
    # For historical, we approximate P/E from EPS + price series
    log.info("Approximating historical P/E from price and EPS...")
    pe_records = []
    for _, row in tqdm(df.iterrows(), total=len(df), desc="P/E approx"):
        ticker = row["ticker"]
        reb_date = row["rebalancing_date"]
        if ticker not in price_cache:
            price_cache[ticker] = load_price_series(ticker)
        ps = price_cache[ticker]
        price = None
        if ps is not None:
            hist = ps[ps.index <= pd.Timestamp(reb_date)]
            if not hist.empty:
                price = float(hist.iloc[-1])

        # EPS from EDGAR num
        # We need to get this from the raw num data for this filing
        # Approximation: net_income / (market_cap / price) — skip for now, set NaN
        # A proper implementation would use shares_outstanding from num
        pe_records.append({"ticker": ticker, "rebalancing_date": reb_date, "_price_at_date": price})

    pe_df = pd.DataFrame(pe_records)
    df = df.merge(pe_df, on=["ticker", "rebalancing_date"], how="left")

    # P/E approximation using shares from EDGAR
    # For simplicity: use current stocks.json P/E as a static feature (valid for prediction, not ideal for training)
    # TODO Phase 2: extract historical shares from num.txt
    df["pe_ttm"] = np.nan
    df["pb_ratio"] = np.nan

    # Compute forward returns (labels)
    all_tickers = df["ticker"].unique().tolist()
    fwd_df = compute_forward_returns(all_tickers, rebalancing_dates)
    if not fwd_df.empty:
        df = df.merge(
            fwd_df[["ticker", "rebalancing_date", "fwd_return", "fwd_return_rel"]],
            on=["ticker", "rebalancing_date"],
            how="left",
        )
    else:
        df["fwd_return"] = np.nan
        df["fwd_return_rel"] = np.nan

    # Remove rows missing the label (last period — no forward data yet)
    df_train = df.dropna(subset=["fwd_return_rel"])
    df_predict = df.copy()  # keep all for prediction

    log.info(f"Feature dataset: {len(df_train):,} rows with labels, {len(df):,} total")

    df.to_parquet(FEATURES_PATH, index=False)
    log.info(f"Saved to {FEATURES_PATH}")
    return df


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    args = p.parse_args()
    df = build_feature_dataset(force=args.force)
    print(df[ALL_FEATURES + ["fwd_return_rel"]].describe())
