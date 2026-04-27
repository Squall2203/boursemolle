"""
Walk-forward LightGBM training for AlphaPicks US strategy.

Walk-forward protocol:
  1. Sort all (ticker, date) observations chronologically.
  2. For each test period T:
     a. Train on all observations where date < T - embargo_gap
        (embargo = 3 months to avoid leakage from autocorrelated features)
     b. Predict returns for date = T
     c. Compute portfolio performance (top-N equal weight)
  3. After all test periods, retrain on full history → final model for production.

No data leakage: the embargo gap prevents using recent financials that may
share temporal correlation with the test label.
"""
import logging
import warnings
from datetime import date
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import mean_squared_error

from config import (
    MODEL_DIR, DATA_DIR, ALL_FEATURES, FUNDAMENTAL_FEATURES,
    LGBM_PARAMS, EARLY_STOPPING_ROUNDS,
    INITIAL_TRAIN_YEARS, MIN_OBSERVATIONS,
)

warnings.filterwarnings("ignore", category=UserWarning)
log = logging.getLogger(__name__)

MODEL_PATH = MODEL_DIR / "lgbm_model.pkl"
SHAP_PATH = MODEL_DIR / "shap_values.parquet"
BACKTEST_PATH = DATA_DIR / "backtest_results.parquet"

EMBARGO_QUARTERS = 1    # skip 1 quarter between train and test to avoid leakage


def prepare_train_test(
    df: pd.DataFrame,
    test_date: date,
    min_train_date: date | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Split data into train (before test_date with embargo) and test (= test_date).
    Returns X_train, X_test, y_train, y_test.
    """
    embargo_date = pd.Timestamp(test_date) - pd.DateOffset(months=3 * EMBARGO_QUARTERS)

    train_mask = (
        (df["rebalancing_date"] < embargo_date.date()) &
        df["fwd_return_rel"].notna()
    )
    if min_train_date:
        train_mask &= df["rebalancing_date"] >= min_train_date

    test_mask = df["rebalancing_date"] == test_date

    train = df[train_mask].copy()
    test = df[test_mask].copy()

    # Cross-sectional rank-normalize features within each period to reduce outlier impact
    for col in FUNDAMENTAL_FEATURES:
        train[col] = train.groupby("rebalancing_date")[col].rank(pct=True)

    # Normalize test features against train distribution
    for col in FUNDAMENTAL_FEATURES:
        if col not in test.columns or test[col].isna().all():
            test[col] = 0.5
        else:
            test[col] = test[col].rank(pct=True)

    X_train = train[ALL_FEATURES].copy()
    y_train = train["fwd_return_rel"].copy()
    X_test = test[ALL_FEATURES].copy()
    y_test = test.get("fwd_return_rel", pd.Series(dtype=float)).copy()

    return X_train, X_test, y_train, y_test


def train_lgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame | None = None,
    y_val: pd.Series | None = None,
) -> lgb.LGBMRegressor:
    """Train a LightGBM model with optional early stopping."""
    model = lgb.LGBMRegressor(**LGBM_PARAMS)

    fit_kwargs: dict = {"feature_name": ALL_FEATURES}
    if X_val is not None and y_val is not None and len(X_val) > 0:
        fit_kwargs["eval_set"] = [(X_val, y_val)]
        fit_kwargs["callbacks"] = [lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False)]

    model.fit(X_train, y_train, **fit_kwargs)
    return model


def run_walk_forward(df: pd.DataFrame) -> pd.DataFrame:
    """
    Execute the full walk-forward backtest.
    Returns a DataFrame with columns: ticker, rebalancing_date, predicted_score, actual_return, in_portfolio.
    """
    all_dates = sorted(df["rebalancing_date"].unique())
    min_date = all_dates[0]
    min_train_cutoff = pd.Timestamp(min_date) + pd.DateOffset(years=INITIAL_TRAIN_YEARS)

    test_dates = [d for d in all_dates if pd.Timestamp(d) >= min_train_cutoff]
    log.info(f"Walk-forward: {len(test_dates)} test periods ({test_dates[0]} → {test_dates[-1]})")

    all_predictions = []

    for i, test_date in enumerate(test_dates):
        X_train, X_test, y_train, y_test = prepare_train_test(df, test_date)

        if len(X_train) < MIN_OBSERVATIONS * 10:
            log.warning(f"  {test_date}: insufficient training data ({len(X_train)} rows), skipping")
            continue

        # Use last 20% of training as validation for early stopping
        split_idx = int(len(X_train) * 0.8)
        X_val = X_train.iloc[split_idx:]
        y_val = y_train.iloc[split_idx:]
        X_tr = X_train.iloc[:split_idx]
        y_tr = y_train.iloc[:split_idx]

        model = train_lgbm(X_tr, y_tr, X_val, y_val)

        if X_test.empty:
            continue

        preds = model.predict(X_test.fillna(X_test.median()))
        test_rows = df[df["rebalancing_date"] == test_date].copy()
        test_rows["predicted_score"] = preds

        # Top-15 picks for this period
        top_n = 15
        top_mask = test_rows["predicted_score"].rank(ascending=False) <= top_n
        test_rows["in_portfolio"] = top_mask

        if not y_test.empty and y_test.notna().any():
            rmse = np.sqrt(mean_squared_error(
                y_test.fillna(0),
                pd.Series(preds, index=y_test.index).fillna(0)
            ))
            log.info(f"  {test_date}: train={len(X_train):,} test={len(X_test):,} RMSE={rmse:.3f} "
                     f"top15 avg={test_rows[top_mask]['fwd_return_rel'].mean():.2f}%")

        all_predictions.append(test_rows[
            ["ticker", "rebalancing_date", "predicted_score", "fwd_return_rel", "fwd_return", "in_portfolio"]
        ])

    if not all_predictions:
        return pd.DataFrame()

    results = pd.concat(all_predictions, ignore_index=True)
    results.to_parquet(BACKTEST_PATH, index=False)
    log.info(f"Walk-forward results saved to {BACKTEST_PATH}")
    return results


def train_final_model(df: pd.DataFrame) -> lgb.LGBMRegressor:
    """Train the production model on all available labeled data."""
    log.info("Training final production model on full dataset...")

    df_labeled = df[df["fwd_return_rel"].notna()].copy()

    # Rank-normalize features cross-sectionally
    for col in FUNDAMENTAL_FEATURES:
        df_labeled[col] = df_labeled.groupby("rebalancing_date")[col].rank(pct=True)

    X = df_labeled[ALL_FEATURES]
    y = df_labeled["fwd_return_rel"]

    model = train_lgbm(X, y)

    joblib.dump(model, MODEL_PATH)
    log.info(f"Final model saved to {MODEL_PATH} ({model.n_estimators_} trees)")

    # Feature importance
    fi = pd.Series(model.feature_importances_, index=ALL_FEATURES).sort_values(ascending=False)
    log.info("Top-10 features by importance:")
    for feat, imp in fi.head(10).items():
        log.info(f"  {feat}: {imp:.0f}")

    return model


def compute_shap_values(
    model: lgb.LGBMRegressor,
    df: pd.DataFrame,
    n_background: int = 500,
) -> pd.DataFrame:
    """
    Compute SHAP values for the most recent rebalancing date.
    Used to generate pick justifications.
    """
    log.info("Computing SHAP values...")
    latest_date = df["rebalancing_date"].max()
    current = df[df["rebalancing_date"] == latest_date].copy()

    for col in FUNDAMENTAL_FEATURES:
        current[col] = current[col].rank(pct=True)

    X = current[ALL_FEATURES].fillna(0.5)

    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X)

    shap_df = pd.DataFrame(shap_vals, columns=ALL_FEATURES)
    shap_df["ticker"] = current["ticker"].values
    shap_df["rebalancing_date"] = latest_date

    shap_df.to_parquet(SHAP_PATH, index=False)
    log.info(f"SHAP values saved for {len(shap_df)} stocks at {latest_date}")
    return shap_df


def run_training(df: pd.DataFrame, skip_walkforward: bool = False) -> lgb.LGBMRegressor:
    """Main training entry point."""
    if not skip_walkforward:
        log.info("=== Walk-forward backtest ===")
        backtest_results = run_walk_forward(df)
        if not backtest_results.empty:
            # Quick summary
            portfolio = backtest_results[backtest_results["in_portfolio"]]
            universe = backtest_results
            port_avg = portfolio["fwd_return"].mean()
            univ_avg = universe["fwd_return"].mean()
            log.info(f"\nBacktest summary:")
            log.info(f"  Portfolio avg monthly return: {port_avg:.2f}%")
            log.info(f"  Universe avg monthly return:  {univ_avg:.2f}%")
            log.info(f"  Alpha: {port_avg - univ_avg:.2f}%")

    log.info("\n=== Final model training ===")
    model = train_final_model(df)
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
