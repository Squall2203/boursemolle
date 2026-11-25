"""
SEC EDGAR data loader — reads from the SQLite PIT database built by download_edgar.py.

If pit_us.db exists, all load functions read from it directly (no re-download).
If it doesn't exist, falls back to downloading quarterly parquets from SEC EDGAR.

PIT contract: filed = actual SEC submission date (not fiscal period end).
"""
import json
import logging
import sqlite3
import time
import zipfile
import io
from datetime import date
from pathlib import Path

import requests
import pandas as pd
from tqdm import tqdm

from config import (
    DATA_DIR, EDGAR_DIR, EDGAR_BASE_URL, TICKER_MAP_URL,
    SEC_HEADERS, SEC_SLEEP, EDGAR_START_YEAR, ALL_TAGS,
)

log = logging.getLogger(__name__)

DB_PATH = DATA_DIR / "pit_us.db"
DOWNLOAD_ATTEMPTS = 4

# Balance sheet tags — instant values (qtrs=0)
_BS_TAGS = {
    "Assets", "AssetsCurrent", "LiabilitiesCurrent",
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "LongTermDebt", "LongTermDebtNoncurrent", "LongTermNotesPayable",
    "DebtAndCapitalLeaseObligations",
    "CashAndCashEquivalentsAtCarryingValue", "Cash",
    "CashCashEquivalentsAndShortTermInvestments",
    "CommonStockSharesOutstanding",
    "WeightedAverageNumberOfDilutedSharesOutstanding",
}


def _infer_qtrs(tag: str, form: str) -> int:
    """Infer the qtrs field from tag type and form type."""
    if tag in _BS_TAGS:
        return 0          # balance sheet = instant
    if "10-K" in str(form):
        return 4          # annual report
    return 1              # quarterly report


# ─── SQLite loaders (primary path) ────────────────────────────────────────────

def _sqlite_load_sub() -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("""
        SELECT cik, filed, form, MAX(ddate) AS period
        FROM facts
        WHERE form IN ('10-K','10-Q','10-K/A','10-Q/A')
        GROUP BY cik, filed, form
    """, conn)
    conn.close()

    df["adsh"] = (
        df["cik"].astype(str) + "_"
        + df["filed"].astype(str) + "_"
        + df["form"].str.replace("/", "_")
    )
    df["filed"] = pd.to_datetime(df["filed"].astype(str), format="%Y%m%d", errors="coerce")
    df["period"] = pd.to_datetime(df["period"].astype(str), format="%Y%m%d", errors="coerce")
    df["cik"] = df["cik"].astype("Int64")
    df["sic"] = pd.NA
    df["name"] = pd.NA
    df["fy"] = pd.NA
    df["fp"] = pd.NA

    return df[["adsh", "cik", "name", "sic", "filed", "period", "form", "fy", "fp"]]


def _sqlite_load_num() -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    chunks = []
    for chunk in pd.read_sql("""
        SELECT cik, tag, ddate, value, filed, form
        FROM facts
        WHERE form IN ('10-K','10-Q','10-K/A','10-Q/A')
    """, conn, chunksize=500_000):
        chunk["adsh"] = (
            chunk["cik"].astype(str) + "_"
            + chunk["filed"].astype(str) + "_"
            + chunk["form"].str.replace("/", "_")
        )
        chunk["ddate"] = pd.to_datetime(
            chunk["ddate"].astype(str), format="%Y%m%d", errors="coerce"
        )
        bs_mask = chunk["tag"].isin(_BS_TAGS)
        annual_mask = chunk["form"].str.contains("10-K", na=False)
        chunk["qtrs"] = 1
        chunk.loc[bs_mask, "qtrs"] = 0
        chunk.loc[~bs_mask & annual_mask, "qtrs"] = 4
        chunk = chunk.dropna(subset=["ddate", "value"])
        chunks.append(chunk[["adsh", "tag", "ddate", "qtrs", "value"]])
    conn.close()

    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame(
        columns=["adsh", "tag", "ddate", "qtrs", "value"]
    )


# ─── Parquet loaders (fallback) ───────────────────────────────────────────────

def _parquet_load_sub() -> pd.DataFrame:
    files = sorted(EDGAR_DIR.glob("*_sub.parquet"))
    if not files:
        raise FileNotFoundError(
            "No EDGAR data found. Run: python download_edgar.py --start-year 2010"
        )
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def _parquet_load_num() -> pd.DataFrame:
    files = sorted(EDGAR_DIR.glob("*_num.parquet"))
    if not files:
        raise FileNotFoundError(
            "No EDGAR data found. Run: python download_edgar.py --start-year 2010"
        )
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


# ─── Public API ───────────────────────────────────────────────────────────────

def load_all_sub() -> pd.DataFrame:
    if DB_PATH.exists():
        log.info(f"Loading sub from SQLite ({DB_PATH.stat().st_size // 1_048_576} MB)...")
        return _sqlite_load_sub()
    return _parquet_load_sub()


def load_all_num() -> pd.DataFrame:
    if DB_PATH.exists():
        log.info("Loading num from SQLite (may take 1-2 min for 40M rows)...")
        return _sqlite_load_num()
    return _parquet_load_num()


def download_ticker_map(force: bool = False) -> dict[int, str]:
    """Download CIK → ticker mapping from SEC (cached locally)."""
    EDGAR_DIR.mkdir(parents=True, exist_ok=True)
    map_path = EDGAR_DIR / "ticker_map.json"
    if map_path.exists() and not force:
        with open(map_path) as f:
            raw = json.load(f)
        return {int(v["cik_str"]): v["ticker"].upper() for v in raw.values()}

    log.info("Downloading CIK → ticker map from SEC...")
    r = requests.get(TICKER_MAP_URL, headers=SEC_HEADERS, timeout=30)
    r.raise_for_status()
    raw = r.json()
    with open(map_path, "w") as f:
        json.dump(raw, f)
    time.sleep(SEC_SLEEP)
    return {int(v["cik_str"]): v["ticker"].upper() for v in raw.values()}


def run_download(force: bool = False):
    """
    If pit_us.db already exists: skip re-download, just refresh ticker map.
    Otherwise: download quarterly parquets from SEC EDGAR.
    """
    if DB_PATH.exists():
        size_mb = DB_PATH.stat().st_size / 1_048_576
        log.info(f"pit_us.db found ({size_mb:.0f} MB) — skipping EDGAR download.")
        download_ticker_map(force=force)
        return

    EDGAR_DIR.mkdir(parents=True, exist_ok=True)
    quarters = _available_quarters()
    log.info(f"Downloading {len(quarters)} quarters from EDGAR...")
    downloaded = 0
    for year, q in tqdm(quarters, desc="EDGAR quarters"):
        if _download_quarter_parquet(year, q, force=force):
            downloaded += 1
    log.info(f"Done. {downloaded} new, {len(quarters) - downloaded} cached.")
    download_ticker_map(force=force)


# ─── Parquet download helpers ─────────────────────────────────────────────────

def _available_quarters(start_year: int = EDGAR_START_YEAR) -> list[tuple[int, int]]:
    today = date.today()
    result = []
    for year in range(start_year, today.year + 1):
        for q in range(1, 5):
            if date(year, q * 3, 1) <= today:
                result.append((year, q))
    return result


def _parse_yyyymmdd(col: pd.Series) -> pd.Series:
    """Dates au format AAAAMMJJ, tolérant un suffixe décimal parasite."""
    text = col.astype("string").str.strip().str.replace(r"\.0$", "", regex=True)
    return pd.to_datetime(text, format="%Y%m%d", errors="coerce")


def _download_quarter_parquet(year: int, quarter: int, force: bool = False) -> bool:
    sp = EDGAR_DIR / f"{year}q{quarter}_sub.parquet"
    np_ = EDGAR_DIR / f"{year}q{quarter}_num.parquet"
    if sp.exists() and np_.exists() and not force:
        return False

    url = f"{EDGAR_BASE_URL}/{year}q{quarter}.zip"
    # Le serveur de la SEC coupe parfois la connexion en cours de route : on réessaie avant d'abandonner,
    # sinon un seul trimestre capricieux fait échouer tout le pipeline.
    r = None
    for attempt in range(1, DOWNLOAD_ATTEMPTS + 1):
        try:
            r = requests.get(url, headers=SEC_HEADERS, timeout=180)
            if r.status_code == 404:
                log.warning(f"  {year}Q{quarter} not yet available")
                return False
            r.raise_for_status()
            break
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
            if attempt == DOWNLOAD_ATTEMPTS:
                raise
            log.warning(f"  {year}Q{quarter}: {type(e).__name__}, nouvel essai {attempt + 1}/{DOWNLOAD_ATTEMPTS}")
            time.sleep(5 * attempt)

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names = z.namelist()
        sub_file = next((n for n in names if n.endswith("sub.txt")), None)
        num_file = next((n for n in names if n.endswith("num.txt")), None)
        if not sub_file or not num_file:
            return False

        with z.open(sub_file) as f:
            sub = pd.read_csv(f, sep="\t", low_memory=False,
                usecols=["adsh","cik","name","sic","filed","period","form","fy","fp"],
                dtype={"cik": "Int64", "adsh": str, "form": str, "sic": "Int64", "filed": str, "period": str})
        sub = sub[sub["form"].isin(["10-K","10-Q","10-K/A","10-Q/A"])].copy()
        # Dates lues comme du texte : dès qu'une seule manque dans le fichier, pandas lit sinon la colonne
        # en nombres décimaux (« 20231231.0 »), plus aucune date n'est reconnue et le trimestre entier
        # est perdu sans message. Six trimestres de 2024 et 2025 disparaissaient ainsi.
        sub["filed"] = _parse_yyyymmdd(sub["filed"])
        sub["period"] = _parse_yyyymmdd(sub["period"])
        sub = sub.dropna(subset=["filed","period","cik"])
        if sub.empty:
            raise RuntimeError(f"{year}Q{quarter} : aucun rapport lisible dans le fichier de la SEC")
        sub.to_parquet(sp, index=False)

        with z.open(num_file) as f:
            num = pd.read_csv(f, sep="\t", low_memory=False,
                usecols=["adsh","tag","ddate","qtrs","value"],
                dtype={"adsh": str, "tag": str, "qtrs": "Int64", "value": float, "ddate": str})
        num = num[num["tag"].isin(ALL_TAGS)].copy()
        num["ddate"] = _parse_yyyymmdd(num["ddate"])
        num = num.dropna(subset=["ddate","value"])
        num.to_parquet(np_, index=False)

    time.sleep(SEC_SLEEP)
    return True
