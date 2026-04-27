"""
Shared configuration for the AlphaPicks ML pipeline.
"""
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent.parent          # repo root
ML_DIR = Path(__file__).parent
DATA_DIR = ML_DIR / "data"
EDGAR_DIR = DATA_DIR / "edgar"
MODEL_DIR = DATA_DIR / "model"
PRICES_DIR = ROOT / "public" / "data" / "prices"
STOCKS_JSON = ROOT / "public" / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "public" / "data" / "picks" / "us_predictions.json"

for d in [DATA_DIR, EDGAR_DIR, MODEL_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── EDGAR settings ───────────────────────────────────────────────────────────

EDGAR_START_YEAR = 2018     # first year to download
EDGAR_BASE_URL = "https://www.sec.gov/files/dera/data/financial-statement-data-sets"
TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_HEADERS = {"User-Agent": "BourseMolle research@boursemolle.com"}
SEC_SLEEP = 0.4             # seconds between SEC requests (rate limit: 10 req/s)

# ─── XBRL tag map — ordered by preference ─────────────────────────────────────
# For each concept, we try tags in order and take the first match.

TAG_MAP: dict[str, list[str]] = {
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
        "SalesRevenueServicesNet",
    ],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": [
        "NetIncomeLoss",
        "ProfitLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ],
    "total_assets": ["Assets"],
    "current_assets": ["AssetsCurrent"],
    "current_liabilities": ["LiabilitiesCurrent"],
    "total_equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "long_term_debt": ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermNotesPayable"],
    "total_debt": ["DebtAndCapitalLeaseObligations", "LongTermDebt"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue", "Cash", "CashCashEquivalentsAndShortTermInvestments"],
    "operating_cf": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "rd_expense": ["ResearchAndDevelopmentExpense"],
    "eps_diluted": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    "shares_outstanding": [
        "CommonStockSharesOutstanding",
        "WeightedAverageNumberOfDilutedSharesOutstanding",
    ],
}

ALL_TAGS: set[str] = {tag for tags in TAG_MAP.values() for tag in tags}

# ─── ML settings ─────────────────────────────────────────────────────────────

# Forward return period (trading days)
FORWARD_DAYS = 21       # ~1 month

# Minimum observations per company to include in training
MIN_OBSERVATIONS = 8

# Walk-forward settings
INITIAL_TRAIN_YEARS = 3     # minimum years of history before first test period
RETRAIN_EVERY_QUARTERS = 1  # retrain every quarter

# LightGBM hyperparameters
LGBM_PARAMS = {
    "objective": "regression",
    "metric": "rmse",
    "n_estimators": 500,
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_child_samples": 30,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

EARLY_STOPPING_ROUNDS = 50

# ─── Feature columns ──────────────────────────────────────────────────────────

FUNDAMENTAL_FEATURES = [
    "gp_margin",
    "op_margin",
    "net_margin",
    "roe",
    "roa",
    "rev_growth_yoy",
    "ni_growth_yoy",
    "debt_to_equity",
    "current_ratio",
    "cash_to_assets",
    "fcf_margin",
    "pe_ttm",
    "pb_ratio",
    "asset_turnover",
    "rd_intensity",
]

MOMENTUM_FEATURES = [
    "mom_1m",
    "mom_3m",
    "mom_6m",
    "mom_12m",
    "mom_12m_skip1m",   # 12M return skipping last month (classic momentum)
    "vol_20d",
    "price_vs_sma200",
    "price_vs_sma50",
]

SECTOR_FEATURES = [
    "sic_div",          # SIC division (broad sector)
]

ALL_FEATURES = FUNDAMENTAL_FEATURES + MOMENTUM_FEATURES + SECTOR_FEATURES

# ─── Universe ─────────────────────────────────────────────────────────────────

# Minimum market cap (USD) to include in ML universe
MIN_MARKET_CAP_USD = 2_000_000_000      # $2B — liquid large/mid caps only

# Top N picks for the US ML strategy
US_STRATEGY_SIZE = 15
