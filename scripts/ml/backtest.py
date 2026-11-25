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

from config import DATA_DIR, MODEL_CARD_PATH, PUBLICATION_CRITERIA, FORWARD_DAYS

log = logging.getLogger(__name__)

BACKTEST_PATH = DATA_DIR / "backtest_results.parquet"
METRICS_PATH = DATA_DIR / "backtest_metrics.json"
CURVE_PATH = DATA_DIR / "backtest_curve.json"



def compute_metrics(monthly_returns: pd.Series, periods_per_year: float = 4) -> dict:
    """Mesures de performance d'une série de rendements successifs qui ne se chevauchent pas."""
    if monthly_returns.empty:
        return {}

    r = monthly_returns.dropna()
    n = len(r)

    cumulative = (1 + r / 100).cumprod()
    total_return = (cumulative.iloc[-1] - 1) * 100

    # Annualized return
    years = n / periods_per_year
    ann_return = ((cumulative.iloc[-1]) ** (1 / years) - 1) * 100 if years > 0 else 0

    # Sharpe
    risk_free = 0.04 / periods_per_year
    excess = r / 100 - risk_free
    sharpe = (excess.mean() / excess.std() * np.sqrt(periods_per_year)) if excess.std() > 0 else 0

    # Sortino
    downside = r[r < 0] / 100
    sortino_denom = np.sqrt((downside ** 2).mean()) * np.sqrt(periods_per_year) if len(downside) > 0 else 1e-9
    sortino = (excess.mean() * periods_per_year) / sortino_denom

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


def _rank_ic(df: pd.DataFrame, score_col: str) -> pd.Series:
    """Corrélation de rang entre une note et le rendement réalisé, date par date."""
    labeled = df.dropna(subset=["fwd_return", score_col])
    return labeled.groupby("rebalancing_date")[[score_col, "fwd_return"]].apply(
        lambda d: d[score_col].corr(d["fwd_return"], method="spearman")
    ).dropna()


def write_model_card(results: pd.DataFrame, portfolio_rets: pd.Series, universe_rets: pd.Series,
                     broad: pd.DataFrame | None = None) -> dict:
    """
    Résume l'évaluation du modèle et décide s'il est publiable (voir PUBLICATION_CRITERIA).
    Chaque date de sélection est jugée sur le rendement des FORWARD_DAYS séances qui la suivent.
    """
    alpha = (portfolio_rets - universe_rets).dropna()
    n = int(len(alpha))
    ic = _rank_ic(results, "predicted_score")

    # Référence simple (moyenne de quelques critères, sans apprentissage) et mesure sur l'univers élargi
    baseline = None
    if "baseline_score" in results.columns:
        base_port = results[results["in_baseline_portfolio"]].groupby("rebalancing_date")["fwd_return"].mean()
        base_alpha = (base_port - universe_rets).dropna()
        base_ic = _rank_ic(results, "baseline_score")
        baseline = {
            "hit_rate": round(float((base_alpha > 0).mean()) if len(base_alpha) else 0.0, 3),
            "median_alpha_pct": round(float(base_alpha.median()) if len(base_alpha) else 0.0, 3),
            "rank_ic": round(float(base_ic.mean()) if len(base_ic) else 0.0, 4),
        }
    broad_ic = _rank_ic(broad, "predicted_score") if broad is not None else pd.Series(dtype=float)

    hit_rate = float((alpha > 0).mean()) if n else 0.0
    median_alpha = float(alpha.median()) if n else 0.0
    rank_ic = float(ic.mean()) if len(ic) else 0.0
    ex_best = alpha.drop(alpha.idxmax()) if n > 1 else alpha

    # Les dates consécutives partagent deux mois de rendement sur trois : elles ne sont pas des preuves
    # indépendantes. La même mesure est donc refaite sur des périodes disjointes (une date sur trois),
    # pour vérifier que le résultat ne tient pas à ce recouvrement.
    step = max(1, round(FORWARD_DAYS / 21))
    independent = alpha.iloc[::step]

    # Stabilité : la corrélation de rang doit rester positive sur la moitié récente de l'historique,
    # sinon l'avantage mesuré appartient peut-être au passé.
    recent_ic = float(ic.iloc[len(ic) // 2:].mean()) if len(ic) >= 4 else 0.0

    # Comportement selon le sens du marché (rendement moyen de l'univers sur la période)
    market = universe_rets.reindex(alpha.index)
    down, up = alpha[market < 0], alpha[market >= 0]
    down_hit = float((down > 0).mean()) if len(down) else None
    up_hit = float((up > 0).mean()) if len(up) else None

    c = PUBLICATION_CRITERIA
    failed = []
    if n < c["min_periods"]:
        failed.append(f"{n} dates évaluées (minimum {c['min_periods']})")
    if hit_rate < c["min_hit_rate"]:
        failed.append(f"devant son univers {hit_rate:.0%} du temps (minimum {c['min_hit_rate']:.0%})")
    if median_alpha <= c["min_median_alpha"]:
        failed.append(f"écart médian de {median_alpha:+.2f} point (doit être positif)")
    if rank_ic < c["min_rank_ic"]:
        failed.append(f"corrélation de rang de {rank_ic:+.3f} (minimum {c['min_rank_ic']:+.2f})")
    if recent_ic <= 0:
        failed.append(f"corrélation de rang de {recent_ic:+.3f} sur la moitié récente (doit être positive)")
    if down_hit is not None and len(down) >= 6 and down_hit < c["min_down_market_hit_rate"]:
        failed.append(f"devant son univers seulement {down_hit:.0%} du temps quand le marché baisse (minimum {c['min_down_market_hit_rate']:.0%}) : "
                      "son avance vient surtout d'actions plus nerveuses que la moyenne")
    if baseline is not None and rank_ic <= baseline["rank_ic"]:
        failed.append(f"ne fait pas mieux que la référence simple (corrélation de rang {rank_ic:+.3f} contre {baseline['rank_ic']:+.3f})")

    card = {
        "evaluated_at": date.today().isoformat(),
        "horizon": f"{FORWARD_DAYS} séances après chaque date de sélection mensuelle",
        "first_date": str(alpha.index.min()) if n else None,
        "last_date": str(alpha.index.max()) if n else None,
        "n_periods": n,
        "n_tickers": int(results["ticker"].nunique()),
        "periods_ahead": int((alpha > 0).sum()),
        "hit_rate": round(hit_rate, 3),
        "mean_alpha_pct": round(float(alpha.mean()) if n else 0.0, 3),
        "median_alpha_pct": round(median_alpha, 3),
        "mean_alpha_ex_best_pct": round(float(ex_best.mean()) if len(ex_best) else 0.0, 3),
        "rank_ic": round(rank_ic, 4),
        "rank_ic_recent_half": round(recent_ic, 4),
        "rank_ic_training_universe": round(float(broad_ic.mean()), 4) if len(broad_ic) else None,
        "n_tickers_training_universe": int(broad["ticker"].nunique()) if broad is not None else None,
        "simple_baseline": baseline,
        "by_market_direction": {
            "up": {"n": int(len(up)), "ahead": int((up > 0).sum()), "hit_rate": round(up_hit, 3) if up_hit is not None else None},
            "down": {"n": int(len(down)), "ahead": int((down > 0).sum()), "hit_rate": round(down_hit, 3) if down_hit is not None else None},
        },
        "independent_periods": {
            "n": int(len(independent)),
            "ahead": int((independent > 0).sum()),
            "median_alpha_pct": round(float(independent.median()) if len(independent) else 0.0, 3),
        },
        "caveat": "Univers limité aux sociétés cotées aujourd'hui : celles qui ont disparu en cours de route "
                  "n'y figurent pas, ce qui embellit un peu le passé. Hors frais de transaction.",
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

    broad = results
    # L'évaluation porte sur les actions du site, celles parmi lesquelles le modèle choisit réellement.
    # L'univers élargi ne sert qu'à l'entraînement et à une mesure de contrôle.
    if "in_site_universe" in results.columns:
        results = results[results["in_site_universe"]]
    log.info(f"Evaluating backtest: {len(results):,} predictions on the site's stocks across "
             f"{results['rebalancing_date'].nunique()} periods ({len(broad):,} on the training universe)")

    portfolio_rets, universe_rets = build_monthly_returns(results)

    # Une sélection par mois, tenue trois mois : les périodes se chevauchent. Pour une courbe cumulée
    # ou un ratio de Sharpe, on ne peut enchaîner que des périodes disjointes, donc une date sur trois.
    step = max(1, round(FORWARD_DAYS / 21))
    port_seq, univ_seq = portfolio_rets.dropna().iloc[::step], universe_rets.dropna().iloc[::step]
    periods_per_year = 252 / FORWARD_DAYS

    port_metrics = compute_metrics(port_seq, periods_per_year)
    univ_metrics = compute_metrics(univ_seq, periods_per_year)

    alpha_periods = (portfolio_rets - universe_rets).dropna()
    avg_alpha = float(alpha_periods.mean())
    hit_vs_bench = float((alpha_periods > 0).mean() * 100)

    metrics = {
        "generated_at": date.today().isoformat(),
        "horizon_sessions": FORWARD_DAYS,
        "portfolio": port_metrics,
        "universe_benchmark": univ_metrics,
        "alpha": {
            "avg_per_period_pct": round(avg_alpha, 3),
            "hit_rate_vs_universe_pct": round(hit_vs_bench, 1),
            "ann_alpha_pct": round(avg_alpha * periods_per_year, 2),
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
        "portfolio": to_cumulative(port_seq),
        "universe": to_cumulative(univ_seq),
    }
    CURVE_PATH.write_text(json.dumps(curve, indent=2))
    log.info(f"Cumulative curve saved to {CURVE_PATH}")

    card = write_model_card(results, portfolio_rets, universe_rets, broad)
    metrics["model_card"] = card

    # Print summary
    p = metrics["portfolio"]
    a = metrics["alpha"]
    log.info("\n" + "=" * 50)
    log.info(f"  Total return:    {p.get('total_return_pct', 0):+.1f}%")
    log.info(f"  Ann. return:     {p.get('ann_return_pct', 0):+.1f}%")
    log.info(f"  Sharpe:          {p.get('sharpe', 0):.2f}")
    log.info(f"  Max drawdown:    {p.get('max_drawdown_pct', 0):.1f}%")
    log.info(f"  Avg α / period:  {a['avg_per_period_pct']:+.2f}%")
    log.info(f"  Ann. alpha:      {a['ann_alpha_pct']:+.1f}%")
    log.info(f"  Hit rate vs univ:{a['hit_rate_vs_universe_pct']:.0f}%")
    log.info("=" * 50)
    log.info(f"  Écart médian:    {card['median_alpha_pct']:+.2f} pt  |  sans la meilleure date: {card['mean_alpha_ex_best_pct']:+.2f} pt")
    log.info(f"  Dates devant l'univers: {card['periods_ahead']}/{card['n_periods']}  |  périodes disjointes: {card['independent_periods']['ahead']}/{card['independent_periods']['n']}")
    log.info(f"  Corrélation de rang: {card['rank_ic']:+.3f}  |  moitié récente: {card['rank_ic_recent_half']:+.3f}  |  univers élargi: {card['rank_ic_training_universe']}")
    d = card["by_market_direction"]
    log.info(f"  Marché en hausse: devant {d['up']['ahead']}/{d['up']['n']}  |  marché en baisse: devant {d['down']['ahead']}/{d['down']['n']}")
    if card["simple_baseline"]:
        b = card["simple_baseline"]
        log.info(f"  Référence simple: devant {b['hit_rate']:.0%} du temps, écart médian {b['median_alpha_pct']:+.2f} pt, corrélation de rang {b['rank_ic']:+.3f}")
    if card["validated"]:
        log.info("  → Modèle VALIDÉ : ses sélections seront publiées.")
    else:
        log.warning("  → Modèle NON validé, ses sélections ne seront pas publiées : " + " ; ".join(card["failed_criteria"]))

    return metrics


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    run_backtest()
