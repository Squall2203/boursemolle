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
ML_PRICES_DIR = DATA_DIR / "prices"                 # historique long, propre au modèle
STOCKS_JSON = ROOT / "public" / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "public" / "data" / "picks" / "us_predictions.json"

for d in [DATA_DIR, EDGAR_DIR, MODEL_DIR, ML_PRICES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── EDGAR settings ───────────────────────────────────────────────────────────

EDGAR_START_YEAR = 2012     # première année de comptes téléchargée
PRICE_START_DATE = "2011-01-01"   # début de l'historique de cours du modèle
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
        "EntityCommonStockSharesOutstanding",
        "CommonStockSharesOutstanding",
        "WeightedAverageNumberOfDilutedSharesOutstanding",
    ],
}

ALL_TAGS: set[str] = {tag for tags in TAG_MAP.values() for tag in tags}

# ─── ML settings ─────────────────────────────────────────────────────────────

# Horizon du rendement à prévoir, en séances. Trois mois : à un mois, le bruit domine.
FORWARD_DAYS = 63

# Une date de sélection par mois (au lieu d'une par trimestre) : trois fois plus d'exemples.
REBALANCE_MONTHS = list(range(1, 13))

# Nombre de mois écartés entre la fin de l'entraînement et la date testée. Le rendement d'une date
# n'est connu que trois mois plus tard : sans cet écart, l'entraînement verrait une partie de la réponse.
EMBARGO_MONTHS = 4

# Minimum observations per company to include in training
MIN_OBSERVATIONS = 8

# Walk-forward settings
INITIAL_TRAIN_YEARS = 3     # minimum years of history before first test period

# Modèle volontairement simple : peu de feuilles, beaucoup d'exemples par feuille, forte régularisation.
# Avec quelques dizaines de milliers de lignes très bruitées, un modèle plus riche apprend du bruit.
LGBM_PARAMS = {
    "objective": "regression",
    "metric": "rmse",
    "n_estimators": 400,
    "learning_rate": 0.03,
    "num_leaves": 15,
    "min_child_samples": 100,
    "subsample": 0.8,
    "subsample_freq": 1,
    "colsample_bytree": 0.7,
    "reg_alpha": 0.5,
    "reg_lambda": 5.0,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}

EARLY_STOPPING_ROUNDS = 40

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
    "asset_turnover",
    "rd_intensity",
]

# Valorisation à la date de sélection : comptes publiés rapportés au cours réellement coté ce jour-là.
# Exprimée en rendement (bénéfice / prix) plutôt qu'en multiple (prix / bénéfice) pour rester
# définie et ordonnée quand le bénéfice est négatif.
VALUATION_FEATURES = [
    "earnings_yield",
    "book_to_price",
    "sales_to_price",
    "fcf_yield",
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

# Variables ramenées à leur rang parmi les actions de la même date (0 = la plus basse, 1 = la plus haute)
RANKED_FEATURES = FUNDAMENTAL_FEATURES + VALUATION_FEATURES + MOMENTUM_FEATURES

ALL_FEATURES = RANKED_FEATURES + SECTOR_FEATURES

# ─── Universe ─────────────────────────────────────────────────────────────────

# Univers d'entraînement : les plus grandes sociétés américaines selon la liste de la SEC (classée par
# taille), en plus des actions du site. Apprendre sur 200 actions seulement, toutes survivantes et
# presque toutes dans l'indice S&P 500 d'aujourd'hui, pousse le modèle à parier sur un style de marché.
TRAINING_UNIVERSE_SIZE = 2000

# Taille minimale, à la date considérée, pour qu'une action serve à l'entraînement (hors actions du site)
MIN_TRAIN_MARKET_CAP_USD = 1_000_000_000

# Minimum market cap (USD) to include in ML universe
MIN_MARKET_CAP_USD = 2_000_000_000      # $2B — liquid large/mid caps only

# Top N picks for the US ML strategy
US_STRATEGY_SIZE = 15

# ─── Critères de publication ──────────────────────────────────────────────────
# Le modèle n'est publié sur le site que si son évaluation sur le passé (chaque trimestre, entraîné
# uniquement sur ce qui précède) montre un avantage régulier, pas un coup de chance isolé.
# La moyenne seule ne suffit pas : un unique trimestre exceptionnel peut la rendre flatteuse.

MODEL_CARD_PATH = MODEL_DIR / "model_card.json"

PUBLICATION_CRITERIA = {
    "min_periods": 36,          # nombre minimal de dates de sélection évaluées (une par mois)
    "min_hit_rate": 0.55,       # part des dates où la sélection bat la moyenne de son univers
    "min_median_alpha": 0.0,    # écart médian à l'univers (en points), strictement positif
    "min_rank_ic": 0.02,        # corrélation de rang moyenne entre prédictions et rendements réalisés
    # Part des périodes de marché baissier où la sélection fait mieux que son univers. Des actions plus
    # nerveuses que la moyenne battent mécaniquement le marché quand il monte : ce n'est pas un talent,
    # et cela se paie quand il baisse. Une vraie capacité de sélection doit tenir dans les deux cas.
    "min_down_market_hit_rate": 0.45,
}
