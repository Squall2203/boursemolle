#!/usr/bin/env python3
"""
Fetch news & analyst opinions for all tickers.
Fallback chain per ticker: TickerTick → Yahoo Finance RSS → Google News RSS
Output: public/data/news/{TICKER}.json
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import feedparser

REPO_ROOT = Path(__file__).parent.parent
STOCKS_FILE = REPO_ROOT / "public" / "data" / "stocks.json"
NEWS_DIR = REPO_ROOT / "public" / "data" / "news"

POSITIVE_KW = [
    "beat", "upgrade", "outperform", "buy", "bullish", "record",
    "strong", "growth", "raised", "exceeds", "surge", "rally",
    "positive", "profit", "gains", "upside", "lifted", "boosted",
    "dépasse", "hausse", "croissance", "bénéfice",
]
NEGATIVE_KW = [
    "miss", "downgrade", "underperform", "sell", "bearish", "loss",
    "weak", "cut", "below", "disappoints", "decline", "drop",
    "warning", "risk", "concern", "pressure", "slump", "fall",
    "perte", "baisse", "recul", "avertissement",
]

HEADERS = {
    "User-Agent": (
        "BourseMolle/1.0 (personal finance tracker; "
        "github.com/Squall2203/boursemolle)"
    )
}

# 8 s between TickerTick requests → stays within 10 req/min
TICKERTICK_DELAY = 8
FALLBACK_DELAY = 4


def score_sentiment(text: str) -> float:
    t = text.lower()
    pos = sum(1 for w in POSITIVE_KW if w in t)
    neg = sum(1 for w in NEGATIVE_KW if w in t)
    total = pos + neg
    return round((pos - neg) / total, 2) if total > 0 else 0.0


def sentiment_label(score: float) -> str:
    if score > 0.1:
        return "positif"
    if score < -0.1:
        return "négatif"
    return "neutre"


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()


def parse_published(entry) -> str:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(
                *entry.published_parsed[:6], tzinfo=timezone.utc
            ).isoformat()
        except Exception:
            pass
    return datetime.now(timezone.utc).isoformat()


def articles_from_feed(feed, source_name: str) -> list[dict]:
    results = []
    for entry in feed.entries[:5]:
        title = entry.get("title", "").strip()
        url = entry.get("link", "")
        if not title or not url:
            continue
        summary = strip_html(entry.get("summary", entry.get("description", "")))
        summary = summary[:200]
        published_at = parse_published(entry)
        text = f"{title} {summary}"
        s = score_sentiment(text)
        results.append({
            "title": title,
            "url": url,
            "source": source_name,
            "published_at": published_at,
            "summary": summary,
            "sentiment": sentiment_label(s),
            "sentiment_score": s,
        })
    return results


def fetch_tickertick(ticker: str) -> list[dict]:
    # TickerTick only covers US tickers reliably
    if "." in ticker:
        return []
    url = f"https://api.tickertick.com/feed?q=tt:{ticker}&n=5"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
        results = []
        for story in data.get("stories", [])[:5]:
            title = story.get("title", "").strip()
            link = story.get("url", "")
            if not title or not link:
                continue
            desc = strip_html(story.get("description", ""))[:200]
            ts = story.get("time", 0)
            # TickerTick: timestamps in ms
            if ts > 1e10:
                ts /= 1000
            published_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else datetime.now(timezone.utc).isoformat()
            source = story.get("site", "")
            text = f"{title} {desc}"
            s = score_sentiment(text)
            results.append({
                "title": title,
                "url": link,
                "source": source or "TickerTick",
                "published_at": published_at,
                "summary": desc,
                "sentiment": sentiment_label(s),
                "sentiment_score": s,
            })
        return results
    except Exception as e:
        print(f"    TickerTick error: {e}")
        return []


def fetch_yahoo_rss(ticker: str) -> list[dict]:
    url = (
        f"https://feeds.finance.yahoo.com/rss/2.0/headline"
        f"?s={ticker}&region=US&lang=en-US"
    )
    try:
        feed = feedparser.parse(url, request_headers=HEADERS)
        return articles_from_feed(feed, "Yahoo Finance")
    except Exception as e:
        print(f"    Yahoo RSS error: {e}")
        return []


def fetch_google_news(ticker: str, name: str = "") -> list[dict]:
    # Use first word of name to refine the query for EU stocks
    first_name = name.split()[0] if name else ""
    query = f"{ticker} {first_name} stock analyst".strip() if first_name else f"{ticker} stock"
    q = requests.utils.quote(query)
    url = (
        f"https://news.google.com/rss/search"
        f"?q={q}&hl=en-US&gl=US&ceid=US:en&when=7d"
    )
    try:
        feed = feedparser.parse(url, request_headers=HEADERS)
        return articles_from_feed(feed, "Google News")
    except Exception as e:
        print(f"    Google News error: {e}")
        return []


def deduplicate(articles: list[dict]) -> list[dict]:
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    result = []
    for a in articles:
        norm = re.sub(r"\W+", " ", a["title"].lower()).strip()[:60]
        if a["url"] not in seen_urls and norm not in seen_titles:
            seen_urls.add(a["url"])
            seen_titles.add(norm)
            result.append(a)
    return result


def aggregate_sentiment(articles: list[dict]) -> tuple[float, str]:
    if not articles:
        return 0.0, "neutre"
    avg = round(sum(a["sentiment_score"] for a in articles) / len(articles), 2)
    return avg, sentiment_label(avg)


def is_fresh(path: Path, max_age_hours: float = 20.0) -> bool:
    if not path.exists():
        return False
    age = (time.time() - path.stat().st_mtime) / 3600
    return age < max_age_hours


def fetch_for_ticker(ticker: str, name: str) -> dict:
    articles: list[dict] = []

    # Primary: TickerTick (US only)
    articles = fetch_tickertick(ticker)
    time.sleep(TICKERTICK_DELAY)

    # Secondary: Yahoo Finance RSS
    if len(articles) < 2:
        yahoo = fetch_yahoo_rss(ticker)
        articles = deduplicate(articles + yahoo)
        time.sleep(FALLBACK_DELAY)

    # Tertiary: Google News RSS
    if len(articles) < 2:
        google = fetch_google_news(ticker, name)
        articles = deduplicate(articles + google)
        time.sleep(FALLBACK_DELAY)

    articles = articles[:5]
    sentiment_score, sentiment_lbl = aggregate_sentiment(articles)

    return {
        "ticker": ticker,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "sentiment_score": sentiment_score,
        "sentiment_label": sentiment_lbl,
        "articles": articles,
    }


def main() -> None:
    NEWS_DIR.mkdir(parents=True, exist_ok=True)

    with open(STOCKS_FILE, encoding="utf-8") as f:
        stocks_data = json.load(f)

    tickers: list[tuple[str, str]] = [
        (s["ticker"], s.get("name", "")) for s in stocks_data["stocks"]
    ]
    total = len(tickers)
    print(f"Fetching news for {total} tickers (est. ~{total * TICKERTICK_DELAY // 60} min)...")

    fetched = 0
    for i, (ticker, name) in enumerate(tickers, 1):
        safe = ticker.replace("/", "_")
        out_file = NEWS_DIR / f"{safe}.json"

        if is_fresh(out_file):
            print(f"[{i}/{total}] {ticker} — skip (fresh)")
            continue

        print(f"[{i}/{total}] {ticker}  {name[:35]}")
        try:
            result = fetch_for_ticker(ticker, name)
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            fetched += 1
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nDone. {fetched} tickers updated → {NEWS_DIR}")


if __name__ == "__main__":
    main()
