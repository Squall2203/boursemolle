"""
Historique de cours long pour le modèle américain.

Les fichiers de cours du site (public/data/prices) ne couvrent que cinq ans : trop peu pour entraîner
et évaluer un modèle. Ce module télécharge, pour les seules actions américaines de l'univers, les cours
quotidiens depuis PRICE_START_DATE, dans le dossier de travail du pipeline (non versionné).

Trois séries par action :
  close      cours de clôture, corrigé des divisions d'actions (tel que fourni par Yahoo)
  adjclose   cours corrigé des divisions ET des dividendes : sert aux rendements et au momentum
  raw_close  cours réellement coté ce jour-là : sert à la valorisation, car les comptes publiés
             (bénéfice par action, nombre d'actions) sont exprimés avant les divisions ultérieures
"""
import json
import logging
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

from config import ML_PRICES_DIR, PRICE_START_DATE, STOCKS_JSON, EDGAR_DIR, TRAINING_UNIVERSE_SIZE

log = logging.getLogger(__name__)

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
YAHOO_HEADERS = {"User-Agent": "Mozilla/5.0"}
YAHOO_SLEEP = 0.25
MAX_AGE_HOURS = 20          # un fichier plus récent n'est pas retéléchargé


def us_universe() -> list[str]:
    raw = json.loads(STOCKS_JSON.read_text())
    return sorted(s["ticker"] for s in raw.get("stocks", []) if s.get("country") == "United States")


def training_universe() -> list[str]:
    """
    Actions du site, plus les TRAINING_UNIVERSE_SIZE premières sociétés de la liste de la SEC
    (classée par taille). Les sociétés étrangères de cette liste ne déposent pas de comptes
    trimestriels américains : elles sont écartées plus loin, faute de comptes.
    """
    tickers = set(us_universe())
    map_path = EDGAR_DIR / "ticker_map.json"
    if map_path.exists():
        entries = list(json.loads(map_path.read_text()).values())[:TRAINING_UNIVERSE_SIZE]
        tickers.update(e["ticker"].upper() for e in entries)
    return sorted(tickers)


def fetch_history(ticker: str) -> pd.DataFrame | None:
    period1 = int(datetime.fromisoformat(PRICE_START_DATE).replace(tzinfo=timezone.utc).timestamp())
    period2 = int(time.time())
    r = requests.get(
        YAHOO_CHART_URL.format(ticker=ticker),
        params={"period1": period1, "period2": period2, "interval": "1d", "events": "div,split"},
        headers=YAHOO_HEADERS, timeout=30,
    )
    if r.status_code != 200:
        return None
    result = (r.json().get("chart", {}).get("result") or [None])[0]
    if not result or not result.get("timestamp"):
        return None

    quote = result["indicators"]["quote"][0]
    adj = (result["indicators"].get("adjclose") or [{}])[0].get("adjclose")
    df = pd.DataFrame({
        "date": pd.to_datetime(result["timestamp"], unit="s").normalize(),
        "close": quote.get("close"),
        "adjclose": adj if adj is not None else quote.get("close"),
    }).dropna(subset=["close", "adjclose"])
    if df.empty:
        return None
    df = df.drop_duplicates(subset=["date"], keep="last").sort_values("date").reset_index(drop=True)

    # Cours réellement coté : on annule l'effet des divisions d'actions postérieures à chaque séance
    factor = np.ones(len(df))
    for split in (result.get("events", {}).get("splits") or {}).values():
        den = split.get("denominator") or 1
        ratio = (split.get("numerator") or 1) / den
        split_date = pd.to_datetime(split["date"], unit="s").normalize()
        if ratio > 0:
            factor[(df["date"] < split_date).values] *= ratio
    df["raw_close"] = df["close"] * factor
    return df


def run_price_download(force: bool = False, full: bool = False) -> int:
    """`full` : tout l'univers d'entraînement. Sinon, seulement les actions du site (suffisant pour prédire)."""
    ML_PRICES_DIR.mkdir(parents=True, exist_ok=True)
    tickers = training_universe() if full else us_universe()
    log.info(f"Downloading long price history for {len(tickers)} US tickers (since {PRICE_START_DATE})...")
    consecutive_failures = 0
    done = failed = cached = 0
    for ticker in tqdm(tickers, desc="Prices"):
        path = ML_PRICES_DIR / f"{ticker}.parquet"
        if path.exists() and not force and (time.time() - path.stat().st_mtime) < MAX_AGE_HOURS * 3600:
            cached += 1
            continue
        try:
            df = fetch_history(ticker)
        except (requests.RequestException, ValueError, KeyError) as e:
            log.warning(f"  {ticker}: {e}")
            df = None
        if df is None:
            failed += 1
            consecutive_failures += 1
            # Une longue série d'échecs signale un blocage côté fournisseur, pas des actions introuvables
            if consecutive_failures >= 40:
                raise RuntimeError("Téléchargement des cours interrompu : 40 échecs consécutifs (fournisseur indisponible ?).")
        else:
            df.to_parquet(path, index=False)
            done += 1
            consecutive_failures = 0
        time.sleep(YAHOO_SLEEP)
    log.info(f"Prices: {done} downloaded, {cached} cached, {failed} unavailable")
    if done + cached == 0:
        raise RuntimeError("Aucun historique de cours n'a pu être téléchargé pour le modèle.")
    return done + cached


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    run_price_download()
