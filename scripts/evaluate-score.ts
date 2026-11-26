/**
 * Mesure ce que valent les notes du site sur le passé.
 * Run: npx tsx scripts/evaluate-score.ts
 *
 * Le dépôt conserve chaque version publiée de stocks.json. Pour une version par semaine, on recalcule
 * la note de chaque action avec la méthode actuelle et les données de l'époque, puis on regarde ce que
 * l'action a fait ensuite. Rien du futur n'entre dans la note : elle ne voit que le fichier de ce jour-là.
 *
 * Sortie : public/data/score-evaluation.json, affiché sur la page Méthodologie.
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { computeScore, type PillarKey } from "../src/lib/scoring.ts"
import { getStockRegion } from "../src/lib/market.ts"
import { toPriceFilename } from "../src/lib/tickerFilename.ts"
import { toEur } from "../src/lib/fx.ts"
import type { Stock } from "../src/types/stock.ts"
import { PILLARS, evaluateDate, summarize, type DateResult, type Row } from "./score-stats.ts"

const ROOT = process.cwd()
const STOCKS_PATH = "public/data/stocks.json"
const PRICES_DIR = path.join(ROOT, "public", "data", "prices")
const OUT_PATH = path.join(ROOT, "public", "data", "score-evaluation.json")

/** Horizons mesurés, en séances de Bourse (environ un mois et trois mois) */
const HORIZONS = [21, 63]
const LARGE_CAP_EUR = 1e9

// ─── Versions passées des données ────────────────────────────────────────────

interface Snapshot { sha: string; date: string }

/** Première version publiée de chaque semaine. */
export function weeklySnapshots(): Snapshot[] {
  const log = execFileSync("git", ["log", "--reverse", "--format=%H %cs", "--", STOCKS_PATH], { cwd: ROOT, encoding: "utf8" })
  const byWeek = new Map<string, Snapshot>()
  for (const line of log.trim().split("\n")) {
    const [sha, date] = line.split(" ")
    const d = new Date(date + "T00:00:00Z")
    // Lundi de la semaine : clé de regroupement
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const week = d.toISOString().slice(0, 10)
    if (!byWeek.has(week)) byWeek.set(week, { sha, date })
  }
  return [...byWeek.values()]
}

export function loadSnapshot(sha: string): Stock[] {
  const raw = execFileSync("git", ["show", `${sha}:${STOCKS_PATH}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  // Les versions les plus anciennes n'avaient pas encore tous les champs : on les complète à vide,
  // la notation traite alors ces chiffres comme des données absentes.
  return ((JSON.parse(raw).stocks ?? []) as Partial<Stock>[]).map((st) => ({
    ...st,
    annualFinancials: st.annualFinancials ?? [],
    dividendHistory: st.dividendHistory ?? [],
    indices: st.indices ?? [],
  })) as Stock[]
}

// ─── Cours ───────────────────────────────────────────────────────────────────

const priceCache = new Map<string, { dates: string[]; closes: number[] } | null>()

function loadPrices(ticker: string) {
  if (priceCache.has(ticker)) return priceCache.get(ticker)!
  const p = path.join(PRICES_DIR, `${toPriceFilename(ticker)}.json`)
  let series: { dates: string[]; closes: number[] } | null = null
  if (fs.existsSync(p)) {
    try {
      const candles = (JSON.parse(fs.readFileSync(p, "utf8")).candles ?? []) as { date: string; close: number }[]
      series = { dates: candles.map((c) => c.date), closes: candles.map((c) => c.close) }
    } catch { /* fichier illisible : action ignorée */ }
  }
  priceCache.set(ticker, series)
  return series
}

/**
 * Rendement en % entre la première séance qui suit la date de la note et `horizon` séances plus tard.
 * L'entrée se fait après la date : la note a été calculée avec les cours de ce jour-là.
 */
export function forwardReturn(ticker: string, date: string, horizon: number): number | null {
  const series = loadPrices(ticker)
  if (!series) return null
  const entry = series.dates.findIndex((d) => d > date)
  if (entry < 0) return null
  // Trou dans l'historique : la première séance disponible est trop éloignée de la date de la note
  if ((Date.parse(series.dates[entry]) - Date.parse(date)) / 86_400_000 > 7) return null
  const exit = entry + horizon
  if (exit >= series.closes.length) return null
  const a = series.closes[entry], b = series.closes[exit]
  if (!(a > 0) || !Number.isFinite(b)) return null
  return (b / a - 1) * 100
}

function main() {
  const snapshots = weeklySnapshots()
  console.log(`📚 ${snapshots.length} versions hebdomadaires de ${snapshots[0]?.date} à ${snapshots[snapshots.length - 1]?.date}`)

  const universes = {
    pea: "Actions éligibles au PEA",
    peaLarge: "Éligibles au PEA de plus d'un milliard d'euros",
    all: "Toutes les actions",
  } as const
  type UniverseId = keyof typeof universes
  const perDate: Record<UniverseId, Record<number, DateResult[]>> = {
    pea: Object.fromEntries(HORIZONS.map((h) => [h, []])),
    peaLarge: Object.fromEntries(HORIZONS.map((h) => [h, []])),
    all: Object.fromEntries(HORIZONS.map((h) => [h, []])),
  }

  for (const snap of snapshots) {
    let stocks: Stock[]
    try { stocks = loadSnapshot(snap.sha) } catch { continue }
    const scored = stocks.map((s) => ({ s, score: computeScore(s, stocks) }))

    for (const h of HORIZONS) {
      const rows: Record<UniverseId, Row[]> = { pea: [], peaLarge: [], all: [] }
      for (const { s, score } of scored) {
        const ret = forwardReturn(s.ticker, snap.date, h)
        if (ret == null) continue
        const row: Row = {
          total: score.total, pillars: score.pillars, ret,
          counted: Object.fromEntries(PILLARS.map((k) => [k, score.explanations[k].counted])) as Record<PillarKey, boolean>,
        }
        rows.all.push(row)
        if (s.peaEligible && getStockRegion(s) === "eu") {
          rows.pea.push(row)
          // Les très petites sociétés peuvent fausser la mesure (cours peu échangés, faillites) :
          // on vérifie que le résultat tient aussi sans elles.
          if ((s.marketCapEur ?? toEur(s.marketCap, s.currency) ?? 0) >= LARGE_CAP_EUR) rows.peaLarge.push(row)
        }
      }
      for (const u of Object.keys(universes) as UniverseId[]) {
        const res = evaluateDate(snap.date, rows[u])
        if (res) perDate[u][h].push(res)
      }
    }
    process.stdout.write(".")
  }
  console.log()

  const output = {
    generatedAt: new Date().toISOString(),
    method: "Note recalculée avec la méthode actuelle sur chaque version hebdomadaire des données, puis comparée au rendement des séances suivantes.",
    universes: (Object.keys(universes) as UniverseId[]).map((u) => ({
      id: u,
      label: universes[u],
      horizons: HORIZONS.map((h) => ({
        sessions: h,
        summary: summarize(perDate[u][h], h),
        dates: perDate[u][h].map(({ date, n, ic, spread, topExcess, bottomExcess }) => ({ date, n, ic, spread, topExcess, bottomExcess })),
      })),
    })),
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
  console.log(`✅ ${OUT_PATH}`)
  for (const u of output.universes) {
    for (const h of u.horizons) {
      const s = h.summary
      console.log(`${u.label} · ${h.sessions} séances : ${s.nDates} dates (${s.independent.n} indépendantes : lien positif ${s.independent.icPositive}, écart positif ${s.independent.spreadPositive}), ${s.avgNames} actions, lien moyen ${s.meanIc} (positif ${s.datesIcPositive}/${s.nDates}), écart médian haut/bas ${s.medianSpread} pt (positif ${s.datesSpreadPositive}/${s.nDates}), ≥7 : ${s.meanTopExcess} pt, <5 : ${s.meanBottomExcess} pt`)
      console.log(`   par critère : ${JSON.stringify(s.pillarIc)}`)
    }
  }
}

// Lancé directement (et non importé par un autre script)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
