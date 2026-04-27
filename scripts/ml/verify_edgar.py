"""
verify_edgar.py
===============
Diagnostic rapide de la base PIT : vérifie l'intégrité,
l'étendue temporelle et un échantillon de données pour
s'assurer que le PIT fonctionne correctement.

Usage :
    python verify_edgar.py
    python verify_edgar.py --ticker AAPL --date 2018-01-15
"""
import argparse
import sqlite3
from pathlib import Path
import pandas as pd

DB_PATH = Path("data/pit_us.db")

def check(db: Path, ticker_cik: str | None, backtest_date: str | None):
    if not db.exists():
        print(f"❌  Base introuvable : {db}")
        print("    Lance : python download_edgar.py --start-year 2010")
        return

    conn = sqlite3.connect(db)

    # ── 1. Couverture temporelle ──────────────────────────────────────────
    print("━━━ 1. Couverture temporelle ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    df_log = pd.read_sql("SELECT year, quarter, n_rows FROM ingestion_log ORDER BY year, quarter", conn)
    if df_log.empty:
        print("❌  Aucun trimestre indexé.")
    else:
        print(f"   Trimestres indexés : {len(df_log)}")
        print(f"   Premier            : {int(df_log.year.min())}Q{int(df_log[df_log.year==df_log.year.min()].quarter.min())}")
        print(f"   Dernier            : {int(df_log.year.max())}Q{int(df_log[df_log.year==df_log.year.max()].quarter.max())}")
        print(f"   Total faits        : {df_log.n_rows.sum():,}")

    # ── 2. Taille de la base ──────────────────────────────────────────────
    total = conn.execute("SELECT COUNT(*) FROM facts").fetchone()[0]
    print(f"\n━━━ 2. Taille ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"   Lignes dans facts : {total:,}")
    size_mb = db.stat().st_size / 1_048_576
    print(f"   Taille fichier    : {size_mb:.0f} MB")

    # ── 3. Index présents ─────────────────────────────────────────────────
    print(f"\n━━━ 3. Index ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    indexes = pd.read_sql("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='facts'", conn)
    for idx in indexes["name"].tolist():
        print(f"   ✓ {idx}")
    if indexes.empty:
        print("   ⚠️  Aucun index — relancer : python download_edgar.py --check")

    # ── 4. Distribution des tags ──────────────────────────────────────────
    print(f"\n━━━ 4. Top 10 tags ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    tags = pd.read_sql(
        "SELECT tag, COUNT(*) AS n FROM facts GROUP BY tag ORDER BY n DESC LIMIT 10", conn
    )
    print(tags.to_string(index=False))

    # ── 5. Vérification PIT (si ticker + date fournis) ────────────────────
    if ticker_cik and backtest_date:
        print(f"\n━━━ 5. Test PIT : CIK={ticker_cik}, date={backtest_date} ━━━━━━━━━━━━━")
        pit = pd.read_sql(f"""
            WITH ranked AS (
                SELECT tag, value, ddate, filed, form,
                       ROW_NUMBER() OVER (
                           PARTITION BY tag ORDER BY filed DESC, ddate DESC
                       ) AS rn
                FROM facts
                WHERE cik = '{ticker_cik}'
                  AND filed <= '{backtest_date.replace('-','')}'
                  AND form IN ('10-K','10-Q','10-K/A','10-Q/A')
            )
            SELECT tag, value, ddate, filed, form
            FROM ranked WHERE rn = 1
            ORDER BY tag
        """, conn)

        if pit.empty:
            print(f"   ❌  Aucune donnée disponible pour CIK {ticker_cik} avant {backtest_date}")
            print(f"      → Vérifie le CIK (ex: Apple = 0000320193)")
        else:
            print(f"   ✅  {len(pit)} métriques disponibles au {backtest_date}")
            print(pit.to_string(index=False))

        # Vérifier que la date de dépôt est bien APRÈS la fin de période
        if not pit.empty:
            pit["filed_dt"] = pd.to_datetime(pit["filed"], format="%Y%m%d", errors="coerce")
            pit["ddate_dt"] = pd.to_datetime(pit["ddate"], format="%Y%m%d", errors="coerce")
            leaks = pit[pit["filed_dt"] <= pit["ddate_dt"]]
            if not leaks.empty:
                print(f"\n   ⚠️  ATTENTION : {len(leaks)} lignes avec filed <= ddate (lookahead possible)")
                print(leaks[["tag","ddate","filed"]].to_string(index=False))
            else:
                print(f"\n   ✅  Contrôle PIT OK : toutes les dates filed > ddate")

    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cik",  type=str, default=None, help="CIK SEC de l'entreprise (ex: 0000320193 pour Apple)")
    parser.add_argument("--date", type=str, default=None, help="Date de backtest (ex: 2018-01-15)")
    args = parser.parse_args()
    check(DB_PATH, args.cik, args.date)
