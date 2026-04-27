"""
AlphaPicks ML pipeline — main CLI orchestrator.

Usage:
  python pipeline.py --download              # Download EDGAR data
  python pipeline.py --features              # Build PIT feature dataset
  python pipeline.py --train                 # Walk-forward + final model
  python pipeline.py --predict               # Score current universe
  python pipeline.py --backtest              # Evaluate walk-forward results
  python pipeline.py --all                   # Run full pipeline end to end

First run (takes ~30-60 min depending on connection speed):
  python pipeline.py --all

Monthly update (fast, ~5 min):
  python pipeline.py --download --predict

The model is retrained quarterly (--train). Monthly runs just regenerate picks.
"""
import argparse
import logging
import sys
import time
from datetime import date
from pathlib import Path

# Make sure we can import sibling modules
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def step_download(args):
    from edgar_download import run_download
    log.info("━━━ Step 1: EDGAR download ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    run_download(force=args.force)


def step_features(args):
    from features import build_feature_dataset
    log.info("━━━ Step 2: Feature engineering ━━━━━━━━━━━━━━━━━━━━━━━━━━")
    df = build_feature_dataset(force=args.force)
    log.info(f"Feature dataset: {len(df):,} rows, {df['ticker'].nunique()} tickers, "
             f"{df['rebalancing_date'].nunique()} periods")
    log.info(f"Features with >50% coverage: "
             f"{sum((df[f].notna().mean() > 0.5) for f in __import__('config').ALL_FEATURES)}"
             f"/{len(__import__('config').ALL_FEATURES)}")
    return df


def step_train(args, df=None):
    from features import build_feature_dataset
    from train import run_training
    log.info("━━━ Step 3: Model training ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    if df is None:
        df = build_feature_dataset()
    t0 = time.time()
    model = run_training(df, skip_walkforward=args.skip_walkforward)
    log.info(f"Training completed in {(time.time() - t0) / 60:.1f} min")
    return model


def step_backtest(args):
    from backtest import run_backtest
    log.info("━━━ Step 4: Backtest evaluation ━━━━━━━━━━━━━━━━━━━━━━━━━━")
    metrics = run_backtest()
    return metrics


def step_predict(args):
    from predict import predict_current, write_predictions
    log.info("━━━ Step 5: Generate predictions ━━━━━━━━━━━━━━━━━━━━━━━━━")
    picks = predict_current(force_features=args.force)
    if picks:
        write_predictions(picks)
        log.info(f"Generated {len(picks)} picks for {date.today().strftime('%B %Y')}")
    else:
        log.error("No picks generated — check EDGAR data and model")
    return picks


def main():
    parser = argparse.ArgumentParser(
        description="AlphaPicks ML Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--download", action="store_true", help="Download EDGAR quarterly data")
    parser.add_argument("--features", action="store_true", help="Build PIT feature dataset")
    parser.add_argument("--train", action="store_true", help="Train LightGBM model (walk-forward)")
    parser.add_argument("--backtest", action="store_true", help="Run backtest evaluation")
    parser.add_argument("--predict", action="store_true", help="Generate current predictions")
    parser.add_argument("--all", action="store_true", help="Run full pipeline")
    parser.add_argument("--force", action="store_true", help="Force re-download / re-computation")
    parser.add_argument("--skip-walkforward", action="store_true",
                        help="Skip walk-forward (train final model only, much faster)")

    args = parser.parse_args()

    if not any([args.download, args.features, args.train, args.backtest, args.predict, args.all]):
        parser.print_help()
        return

    t_start = time.time()
    df = None

    try:
        if args.all or args.download:
            step_download(args)

        if args.all or args.features:
            df = step_features(args)

        if args.all or args.train:
            step_train(args, df)

        if args.all or args.backtest:
            if not args.skip_walkforward:
                step_backtest(args)

        if args.all or args.predict:
            step_predict(args)

    except FileNotFoundError as e:
        log.error(str(e))
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(0)

    elapsed = (time.time() - t_start) / 60
    log.info(f"\nPipeline completed in {elapsed:.1f} min")


if __name__ == "__main__":
    main()
