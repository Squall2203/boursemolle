"""
Walk-forward LightGBM training for AlphaPicks US strategy.

Principe de l'évaluation (« walk-forward ») :
  1. Pour chaque date de sélection T, le modèle est entraîné uniquement sur les dates antérieures à
     T moins EMBARGO_MONTHS. Le rendement d'une date n'est connu que trois mois après : sans cet
     écart, l'entraînement verrait une partie de la réponse à la question posée en T.
  2. Il classe les actions disponibles en T ; on retient les mieux classées.
  3. On compare ensuite leur rendement réel à celui de l'ensemble des actions classées.
  4. Une fois toutes les dates évaluées, le modèle final est réentraîné sur tout l'historique.
"""
import logging
import warnings

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap

from config import (
    MODEL_DIR, DATA_DIR, ALL_FEATURES,
    LGBM_PARAMS, EARLY_STOPPING_ROUNDS,
    INITIAL_TRAIN_YEARS, MIN_OBSERVATIONS, EMBARGO_MONTHS, US_STRATEGY_SIZE,
)
from features import rank_features

warnings.filterwarnings("ignore", category=UserWarning)
log = logging.getLogger(__name__)

MODEL_PATH = MODEL_DIR / "lgbm_model.pkl"
SHAP_PATH = MODEL_DIR / "shap_values.parquet"
BACKTEST_PATH = DATA_DIR / "backtest_results.parquet"

# Part des dates d'entraînement les plus récentes réservée au réglage du nombre d'arbres
VALIDATION_SHARE = 0.15
# Le modèle n'est réentraîné qu'une date sur trois : entre deux, il change très peu
RETRAIN_EVERY = 3


def fit_model(train: pd.DataFrame, n_estimators: int | None = None) -> tuple[lgb.LGBMRegressor, int]:
    """
    Entraîne un modèle sur des lignes déjà ramenées en rangs. Sans `n_estimators`, le nombre d'arbres
    est réglé sur les dates les plus récentes de l'entraînement (jamais sur des lignes tirées au hasard :
    des actions de la même date se ressemblent trop, le réglage serait trop optimiste).
    """
    params = dict(LGBM_PARAMS)
    if n_estimators is not None:
        params["n_estimators"] = n_estimators
        model = lgb.LGBMRegressor(**params)
        model.fit(train[ALL_FEATURES], train["target"])
        return model, n_estimators

    dates = np.sort(train["rebalancing_date"].unique())
    n_val = max(1, int(len(dates) * VALIDATION_SHARE))
    val_dates = set(dates[-n_val:])
    is_val = train["rebalancing_date"].isin(val_dates)
    tr, val = train[~is_val], train[is_val]
    model = lgb.LGBMRegressor(**params)
    if len(tr) == 0 or len(val) == 0:
        model.fit(train[ALL_FEATURES], train["target"])
        return model, params["n_estimators"]
    model.fit(
        tr[ALL_FEATURES], tr["target"],
        eval_set=[(val[ALL_FEATURES], val["target"])],
        callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False)],
    )
    best = int(model.best_iteration_ or params["n_estimators"])
    return model, max(best, 20)


def run_walk_forward(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Évalue le modèle date par date. Renvoie les prédictions de chaque date et le nombre d'arbres
    médian retenu, réutilisé pour le modèle final.
    """
    ranked = rank_features(df)
    all_dates = sorted(ranked["rebalancing_date"].unique())
    first_test = pd.Timestamp(all_dates[0]) + pd.DateOffset(years=INITIAL_TRAIN_YEARS)
    test_dates = [d for d in all_dates if pd.Timestamp(d) >= first_test]
    log.info(f"Walk-forward: {len(test_dates)} test dates ({test_dates[0]} → {test_dates[-1]})")

    labeled = ranked[ranked["target"].notna()]
    predictions = []
    best_iterations = []
    model = None

    for i, test_date in enumerate(test_dates):
        cutoff = (pd.Timestamp(test_date) - pd.DateOffset(months=EMBARGO_MONTHS)).date()
        if model is None or i % RETRAIN_EVERY == 0:
            train = labeled[labeled["rebalancing_date"] < cutoff]
            if len(train) < MIN_OBSERVATIONS * 100:
                continue
            model, best = fit_model(train)
            best_iterations.append(best)

        test = ranked[ranked["rebalancing_date"] == test_date]
        if test.empty:
            continue
        out = test[["ticker", "rebalancing_date", "fwd_return", "fwd_return_rel"]].copy()
        out["predicted_score"] = model.predict(test[ALL_FEATURES])
        out["in_portfolio"] = out["predicted_score"].rank(ascending=False, method="first") <= US_STRATEGY_SIZE
        predictions.append(out)

    if not predictions:
        return pd.DataFrame(), LGBM_PARAMS["n_estimators"]

    results = pd.concat(predictions, ignore_index=True)
    results.to_parquet(BACKTEST_PATH, index=False)
    n_trees = int(np.median(best_iterations))
    log.info(f"Walk-forward: {results['rebalancing_date'].nunique()} dates evaluated, "
             f"{len(best_iterations)} trainings, median trees = {n_trees}")
    return results, n_trees


def train_final_model(df: pd.DataFrame, n_estimators: int | None = None) -> lgb.LGBMRegressor:
    """Entraîne le modèle de production sur tout l'historique disponible."""
    log.info("Training final production model on full dataset...")
    labeled = rank_features(df)
    labeled = labeled[labeled["target"].notna()]
    if len(labeled) < MIN_OBSERVATIONS * 100:
        raise RuntimeError(
            f"Jeu d'entraînement trop petit ({len(labeled)} lignes) : le modèle n'est pas entraîné."
        )
    log.info(f"Training set: {len(labeled):,} rows, {labeled['ticker'].nunique()} tickers, "
             f"{labeled['rebalancing_date'].nunique()} dates")

    model, n_trees = fit_model(labeled, n_estimators=n_estimators)
    joblib.dump(model, MODEL_PATH)
    log.info(f"Final model saved to {MODEL_PATH} ({n_trees} trees)")

    fi = pd.Series(model.feature_importances_, index=ALL_FEATURES).sort_values(ascending=False)
    log.info("Top-10 features by importance:")
    for feat, imp in fi.head(10).items():
        log.info(f"  {feat}: {imp:.0f}")
    return model


def compute_shap_values(model: lgb.LGBMRegressor, df: pd.DataFrame) -> pd.DataFrame:
    """Contribution de chaque variable aux notes de la date la plus récente (sert aux justifications)."""
    log.info("Computing SHAP values...")
    ranked = rank_features(df)
    latest_date = ranked["rebalancing_date"].max()
    current = ranked[ranked["rebalancing_date"] == latest_date]

    explainer = shap.TreeExplainer(model)
    shap_df = pd.DataFrame(explainer.shap_values(current[ALL_FEATURES]), columns=ALL_FEATURES)
    shap_df["ticker"] = current["ticker"].values
    shap_df["rebalancing_date"] = latest_date
    shap_df.to_parquet(SHAP_PATH, index=False)
    log.info(f"SHAP values saved for {len(shap_df)} stocks at {latest_date}")
    return shap_df


def run_training(df: pd.DataFrame, skip_walkforward: bool = False) -> lgb.LGBMRegressor:
    """Main training entry point."""
    n_trees = None
    if not skip_walkforward:
        log.info("=== Walk-forward backtest ===")
        results, n_trees = run_walk_forward(df)
        if results.empty:
            log.warning("Walk-forward: aucune date évaluée (historique insuffisant)")
            n_trees = None

    log.info("\n=== Final model training ===")
    # Sans évaluation préalable, le nombre d'arbres est réglé sur les dates les plus récentes
    model = train_final_model(df, n_estimators=n_trees)
    compute_shap_values(model, df)
    return model


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
    from features import build_feature_dataset
    p = argparse.ArgumentParser()
    p.add_argument("--skip-walkforward", action="store_true")
    p.add_argument("--force-features", action="store_true")
    args = p.parse_args()
    df = build_feature_dataset(force=args.force_features)
    run_training(df, skip_walkforward=args.skip_walkforward)
