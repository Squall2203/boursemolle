"""
Backtest evaluation for the AlphaPicks ML pipeline.

Computes portfolio-level metrics from walk-forward predictions:
  - Monthly returns (equal-weighted top-N portfolio)
  - Cumulative return curve
  - Sharpe ratio, Sortino ratio, max drawdown
  - Hit rate (% of periods with positive alpha vs universe)
  - Alpha vs S&P 500 benchmark

Outputs:
  data/backtest_metrics.json  — scalar metrics (for UI badge)
  data/backtest_curve.json    — monthly cumulative returns (for chart)
"""
import json
import logging
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from config import DATA_DIR, OUTPUT_JSON, MODEL_CARD_PATH, PUBLICATION_CRITERIA

log = logging.getLogger(__name__)

BACKTEST_PATH = DATA_DIR / "backtest_results.parquet"
METRICS_PATH = DATA_DIR / "backtest_metrics.json"
CURVE_PATH = DATA_DIR / "backtest_curve.json"

RISK_FREE_MONTHLY = 0.04 / 12       # 4% annual risk-free rate, monthly


def compute_metrics(monthly_returns: pd.Series) -> dict:
    """Compute standard performance metrics from a monthly return series."""
    if monthly_returns.empty:
        return {}

    r = monthly_returns.dropna()
    n = len(r)

    cumulative = (1 + r / 100).cumprod()
    total_return = (cumulative.iloc[-1] - 1) * 100

    # Annualized return
    years = n / 12
    ann_return = ((cumulative.iloc[-1]) ** (1 / years) - 1) * 100 if years > 0 else 0

    # Sharpe
    excess = r / 100 - RISK_FREE_MONTHLY
    sharpe = (excess.mean() / excess.std() * np.sqrt(12)) if excess.std() > 0 else 0

    # Sortino
    downside = r[r < 0] / 100
    sortino_denom = np.sqrt((downside ** 2).mean()) * np.sqrt(12) if len(downside) > 0 else 1e-9
    sortino = ((r / 100 - RISK_FREE_MONTHLY).mean() * 12) / sortino_denom

    # Max drawdown
    running_max = cumulative.cummax()
    drawdown = (cumulative / running_max - 1) * 100
    max_dd = drawdown.min()

    # Hit rate (% of months positive)
    hit_rate = (r > 0).mean() * 100

    return {
        "total_return_pct": round(float(total_return), 2),
        "ann_return_pct": round(float(ann_return), 2),
        "sharpe": round(float(sharpe), 3),
        "sortino": round(float(sortino), 3),
        "max_drawdown_pct": round(float(max_dd), 2),
        "hit_rate_pct": round(float(hit_rate), 1),
        "n_periods": int(n),
    }


def build_monthly_returns(results: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """
    Build monthly return series for portfolio (top-N) and equal-weight universe.
    Returns (portfolio_returns, universe_returns) as monthly % Series.
    """
    portfolio = (
        results[results["in_portfolio"]]
        .groupby("rebalancing_date")["fwd_return"]
        .mean()
    )
    universe = (
        results
        .groupby("rebalancing_date")["fwd_return"]
        .mean()
    )
    return portfolio, universe


def write_model_card(results: pd.DataFrame, portfolio_rets: pd.Series, universe_rets: pd.Series) -> dict:
    """
    Résume l'évaluation du modèle et décide s'il est publiable (voir PUBLICATION_CRITERIA).
    Les rendements sont ceux des 21 séances qui suivent chaque date de sélection trimestrielle.
    """
    alpha = (portfolio_rets - universe_rets).dropna()
    n = int(len(alpha))
    labeled = results.dropna(subset=["fwd_return"])
    ic = labeled.groupby("rebalancing_date").apply(
        lambda d: d["predicted_score"].corr(d["fwd_return"], method="spearman")
    ).dropna()

    hit_rate = float((alpha > 0).mean()) if n else 0.0
    median_alpha = float(alpha.median()) if n else 0.0
    rank_ic = float(ic.mean()) if len(ic) else 0.0
    ex_best = alpha.drop(alpha.idxmax()) if n > 1 else alpha

    c = PUBLICATION_CRITERIA
    failed = []
    if n < c["min_periods"]:
        failed.append(f"{n} trimestres évalués (minimum {c['min_periods']})")
    if hit_rate < c["min_hit_rate"]:
        failed.append(f"devant son univers {hit_rate:.0%} du temps (minimum {c['min_hit_rate']:.0%})")
    if median_alpha <= c["min_median_alpha"]:
        failed.append(f"écart médian de {median_alpha:+.2f} point (doit être positif)")
    if rank_ic < c["min_rank_ic"]:
        failed.append(f"corrélation de rang de {rank_ic:+.3f} (minimum {c['min_rank_ic']:+.2f})")

    card = {
        "evaluated_at": date.today().isoformat(),
        "horizon": "21 séances après chaque date de sélection trimestrielle",
        "n_periods": n,
        "n_tickers": int(results["ticker"].nunique()),
        "periods_ahead": int((alpha > 0).sum()),
        "hit_rate": round(hit_rate, 3),
        "mean_alpha_pct": round(float(alpha.mean()) if n else 0.0, 3),
        "median_alpha_pct": round(median_alpha, 3),
        "mean_alpha_ex_best_pct": round(float(ex_best.mean()) if len(ex_best) else 0.0, 3),
        "rank_ic": round(rank_ic, 4),
        "criteria": c,
        "failed_criteria": failed,
        "validated": len(failed) == 0,
    }
    MODEL_CARD_PATH.write_text(json.dumps(card, indent=2, ensure_ascii=False))
    log.info(f"Model card saved to {MODEL_CARD_PATH}")
    return card


def run_backtest(results: pd.DataFrame | None = None) -> dict:
    """
    Load walk-forward results and compute full performance metrics.
    """
    if results is None:
        if not BACKTEST_PATH.exists():
            raise FileNotFoundError(f"No backtest results found at {BACKTEST_PATH}. Run train.py first.")
        results = pd.read_parquet(BACKTEST_PATH)

    log.info(f"Evaluating backtest: {len(results):,} predictions across {results['rebalancing_date'].nunique()} periods")

    portfolio_rets, universe_rets = build_monthly_returns(results)

    port_metrics = compute_metrics(portfolio_rets)
    univ_metrics = compute_metrics(universe_rets)

    alpha_periods = portfolio_rets - universe_rets
    avg_alpha = float(alpha_periods.mean())
    hit_vs_bench = float((alpha_periods > 0).mean() * 100)

    metrics = {
        "generated_at": date.today().isoformat(),
        "portfolio": port_metrics,
        "universe_benchmark": univ_metrics,
        "alpha": {
            "avg_monthly_pct": round(avg_alpha, 3),
            "hit_rate_vs_universe_pct": round(hit_vs_bench, 1),
            "ann_alpha_pct": round(avg_alpha * 12, 2),
        },
    }

    METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    log.info(f"Metrics saved to {METRICS_PATH}")

    # Cumulative curves for chart
    def to_cumulative(rets: pd.Series) -> list[dict]:
        cum = (1 + rets / 100).cumprod() * 100
        return [
            {"date": str(d), "value": round(float(v), 2)}
            for d, v in cum.items()
        ]

    curve = {
        "portfolio": to_cumulative(portfolio_rets),
        "universe": to_cumulative(universe_rets),
    }
    CURVE_PATH.write_text(json.dumps(curve, indent=2))
    log.info(f"Cumulative curve saved to {CURVE_PATH}")

    card = write_model_card(results, portfolio_rets, universe_rets)
    metrics["model_card"] = card

    # Print summary
    p = metrics["portfolio"]
    a = metrics["alpha"]
    log.info("\n" + "=" * 50)
    log.info(f"  Total return:    {p.get('total_return_pct', 0):+.1f}%")
    log.info(f"  Ann. return:     {p.get('ann_return_pct', 0):+.1f}%")
    log.info(f"  Sharpe:          {p.get('sharpe', 0):.2f}")
    log.info(f"  Max drawdown:    {p.get('max_drawdown_pct', 0):.1f}%")
    log.info(f"  Avg monthly α:   {a['avg_monthly_pct']:+.2f}%")
    log.info(f"  Ann. alpha:      {a['ann_alpha_pct']:+.1f}%")
    log.info(f"  Hit rate vs univ:{a['hit_rate_vs_universe_pct']:.0f}%")
    log.info("=" * 50)
    log.info(f"  Écart médian:    {card['median_alpha_pct']:+.2f} pt  |  sans le meilleur trimestre: {card['mean_alpha_ex_best_pct']:+.2f} pt")
    log.info(f"  Trimestres devant l'univers: {card['periods_ahead']}/{card['n_periods']}  |  corrélation de rang: {card['rank_ic']:+.3f}")
    if card["validated"]:
        log.info("  → Modèle VALIDÉ : ses sélections seront publiées.")
    else:
        log.warning("  → Modèle NON validé, ses sélections ne seront pas publiées : " + " ; ".join(card["failed_criteria"]))

    return metrics


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    run_backtest()
