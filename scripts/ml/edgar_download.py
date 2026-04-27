"""
SEC EDGAR Financial Statement Data Sets downloader.

Downloads quarterly ZIP files from:
  https://www.sec.gov/dera/data/financial-statement-data-sets/{year}q{quarter}.zip

Each ZIP contains sub.txt (filings metadata) and num.txt (numeric values).
We extract and store only the relevant rows as parquet for fast loading.

Point-in-Time guarantee:
  sub.filed  = the actual date the document was submitted to SEC
  sub.period = the fiscal period end date (ALWAYS use filed for PIT, not period)
"""
import logging
import time
import zipfile
import io
import json
from datetime import date
from pathlib import Path

import requests
import pandas as pd
from tqdm import tqdm

from config import (
    EDGAR_DIR, EDGAR_BASE_URL, TICKER_MAP_URL, SEC_HEADERS, SEC_SLEEP,
    EDGAR_START_YEAR, ALL_TAGS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


def available_quarters(start_year: int = EDGAR_START_YEAR) -> list[tuple[int, int]]:
    """All (year, quarter) pairs from start_year through last completed quarter."""
    today = date.today()
    result = []
    for year in range(start_year, today.year + 1):
        for q in range(1, 5):
            # Quarter q ends on month q*3
            quarter_end_month = q * 3
            quarter_end = date(year, quarter_end_month, 1)
            if quarter_end <= today:
                result.append((year, q))
    return result


def sub_path(year: int, quarter: int) -> Path:
    return EDGAR_DIR / f"{year}q{quarter}_sub.parquet"


def num_path(year: int, quarter: int) -> Path:
    return EDGAR_DIR / f"{year}q{quarter}_num.parquet"


def download_quarter(year: int, quarter: int, force: bool = False) -> bool:
    """Download and parse one quarter. Returns True if downloaded, False if skipped."""
    sp, np_ = sub_path(year, quarter), num_path(year, quarter)
    if sp.exists() and np_.exists() and not force:
        return False

    url = f"{EDGAR_BASE_URL}/{year}q{quarter}.zip"
    log.info(f"Downloading {year}Q{quarter} from {url}")

    try:
        r = requests.get(url, headers=SEC_HEADERS, timeout=120)
        r.raise_for_status()
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            log.warning(f"  {year}Q{quarter} not yet available on EDGAR")
            return False
        raise

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names = z.namelist()

        # ── sub.txt ──────────────────────────────────────────────────────────
        sub_file = next((n for n in names if n.endswith("sub.txt")), None)
        if not sub_file:
            log.warning(f"  sub.txt missing in {year}Q{quarter}.zip")
            return False

        with z.open(sub_file) as f:
            sub = pd.read_csv(
                f, sep="\t", low_memory=False,
                usecols=["adsh", "cik", "name", "sic", "filed", "period", "form", "fy", "fp"],
                dtype={"cik": "Int64", "adsh": str, "form": str, "sic": "Int64"},
            )
        # Keep only 10-K and 10-Q (including amendments)
        sub = sub[sub["form"].isin(["10-K", "10-Q", "10-K/A", "10-Q/A"])].copy()
        sub["filed"] = pd.to_datetime(sub["filed"].astype(str), format="%Y%m%d", errors="coerce")
        sub["period"] = pd.to_datetime(sub["period"].astype(str), format="%Y%m%d", errors="coerce")
        sub = sub.dropna(subset=["filed", "period", "cik"])
        sub.to_parquet(sp, index=False)
        log.info(f"  sub: {len(sub):,} filings saved")

        # ── num.txt ──────────────────────────────────────────────────────────
        num_file = next((n for n in names if n.endswith("num.txt")), None)
        if not num_file:
            log.warning(f"  num.txt missing in {year}Q{quarter}.zip")
            return False

        with z.open(num_file) as f:
            num = pd.read_csv(
                f, sep="\t", low_memory=False,
                usecols=["adsh", "tag", "ddate", "qtrs", "value"],
                dtype={"adsh": str, "tag": str, "qtrs": "Int64", "value": float},
            )
        # Keep only our relevant tags
        num = num[num["tag"].isin(ALL_TAGS)].copy()
        num["ddate"] = pd.to_datetime(num["ddate"].astype(str), format="%Y%m%d", errors="coerce")
        num = num.dropna(subset=["ddate", "value"])
        num.to_parquet(np_, index=False)
        log.info(f"  num: {len(num):,} data points saved")

    time.sleep(SEC_SLEEP)
    return True


def download_ticker_map(force: bool = False) -> dict[int, str]:
    """Download CIK → ticker mapping from SEC."""
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


def load_all_sub() -> pd.DataFrame:
    """Load and concatenate all downloaded sub parquet files."""
    files = sorted(EDGAR_DIR.glob("*_sub.parquet"))
    if not files:
        raise FileNotFoundError("No EDGAR data found. Run download first.")
    dfs = [pd.read_parquet(f) for f in files]
    return pd.concat(dfs, ignore_index=True)


def load_all_num() -> pd.DataFrame:
    """Load and concatenate all downloaded num parquet files."""
    files = sorted(EDGAR_DIR.glob("*_num.parquet"))
    if not files:
        raise FileNotFoundError("No EDGAR data found. Run download first.")
    dfs = [pd.read_parquet(f) for f in files]
    return pd.concat(dfs, ignore_index=True)


def run_download(start_year: int = EDGAR_START_YEAR, force: bool = False):
    """Download all missing quarters."""
    quarters = available_quarters(start_year)
    log.info(f"Checking {len(quarters)} quarters ({quarters[0][0]}Q{quarters[0][1]} → {quarters[-1][0]}Q{quarters[-1][1]})")
    downloaded = 0
    for year, q in tqdm(quarters, desc="EDGAR quarters"):
        if download_quarter(year, q, force=force):
            downloaded += 1
    log.info(f"Done. {downloaded} new quarters downloaded, {len(quarters) - downloaded} already cached.")
    # Also refresh ticker map
    download_ticker_map(force=force)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--start-year", type=int, default=EDGAR_START_YEAR)
    p.add_argument("--force", action="store_true")
    args = p.parse_args()
    run_download(args.start_year, args.force)
