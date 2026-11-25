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
import { computeScore, type PillarKey } from "../src/lib/scoring.ts"
import { getStockRegion } from "../src/lib/market.ts"
import { toPriceFilename } from "../src/lib/tickerFilename.ts"
import { toEur } from "../src/lib/fx.ts"
import type { Stock } from "../src/types/stock.ts"

const ROOT = process.cwd()
const STOCKS_PATH = "public/data/stocks.json"
const PRICES_DIR = path.join(ROOT, "public", "data", "prices")
const OUT_PATH = path.join(ROOT, "public", "data", "score-evaluation.json")

/** Horizons mesurés, en séances de Bourse (environ un mois et trois mois) */
const HORIZONS = [21, 63]
/** En dessous de ce nombre d'actions notées, une date n'est pas exploitable */
const MIN_NAMES = 50
const LARGE_CAP_EUR = 1e9
const PILLARS: PillarKey[] = ["valorisation", "qualite", "croissance", "sante", "dividende", "momentum", "quant"]

// ─── Versions passées des données ────────────────────────────────────────────

interface Snapshot { sha: string; date: string }

/** Première version publiée de chaque semaine. */
function weeklySnapshots(): Snapshot[] {
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

function loadSnapshot(sha: string): Stock[] {
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
function forwardReturn(ticker: string, date: string, horizon: number): number | null {
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

// ─── Statistiques ────────────────────────────────────────────────────────────

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k][1]] = rank
    i = j + 1
  }
  return out
}

/** Corrélation de rang (Spearman) : +1 si l'ordre des notes est exactement celui des rendements, 0 si aucun lien. */
function rankCorrelation(a: number[], b: number[]): number | null {
  if (a.length < 10) return null
  const ra = ranks(a), rb = ranks(b)
  const mean = (a.length + 1) / 2
  let num = 0, da = 0, db = 0
  for (let i = 0; i < a.length; i++) {
    num += (ra[i] - mean) * (rb[i] - mean)
    da += (ra[i] - mean) ** 2
    db += (rb[i] - mean) ** 2
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null
}

const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)
const median = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

// ─── Évaluation ──────────────────────────────────────────────────────────────

interface Row { total: number; pillars: Record<PillarKey, number>; counted: Record<PillarKey, boolean>; ret: number }

interface DateResult {
  date: string
  n: number
  /** Lien entre la note globale et le rendement qui a suivi */
  ic: number
  /** Rendement moyen du cinquième le mieux noté moins celui du cinquième le moins bien noté, en points */
  spread: number
  /** Rendement moyen des actions notées 7 ou plus, moins la moyenne de toutes, en points (null s'il y en a moins de 5) */
  topExcess: number | null
  /** Même chose pour les actions notées moins de 5 */
  bottomExcess: number | null
  pillarIc: Partial<Record<PillarKey, number>>
}

function evaluateDate(date: string, rows: Row[]): DateResult | null {
  if (rows.length < MIN_NAMES) return null
  const rets = rows.map((r) => r.ret)
  const ic = rankCorrelation(rows.map((r) => r.total), rets)
  if (ic == null) return null

  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const fifth = Math.floor(sorted.length / 5)
  const spread = mean(sorted.slice(0, fifth).map((r) => r.ret)) - mean(sorted.slice(-fifth).map((r) => r.ret))

  const all = mean(rets)
  const top = rows.filter((r) => r.total >= 7).map((r) => r.ret)
  const bottom = rows.filter((r) => r.total < 5).map((r) => r.ret)

  const pillarIc: Partial<Record<PillarKey, number>> = {}
  for (const k of PILLARS) {
    const counted = rows.filter((r) => r.counted[k])
    const c = rankCorrelation(counted.map((r) => r.pillars[k]), counted.map((r) => r.ret))
    if (c != null) pillarIc[k] = round(c, 3)
  }

  return {
    date, n: rows.length, ic: round(ic, 3), spread: round(spread),
    topExcess: top.length >= 5 ? round(mean(top) - all) : null,
    bottomExcess: bottom.length >= 5 ? round(mean(bottom) - all) : null,
    pillarIc,
  }
}

/**
 * Dates dont les périodes de mesure ne se chevauchent pas. Deux dates séparées d'une semaine partagent
 * presque tout leur rendement à trois mois : elles ne valent pas deux confirmations distinctes.
 */
function independentDates(dates: DateResult[], sessions: number): DateResult[] {
  const gapDays = sessions * 1.45 // séances de Bourse → jours calendaires
  const out: DateResult[] = []
  for (const d of dates) {
    const last = out[out.length - 1]
    if (!last || (Date.parse(d.date) - Date.parse(last.date)) / 86_400_000 >= gapDays) out.push(d)
  }
  return out
}

function summarize(dates: DateResult[], sessions: number) {
  const indep = independentDates(dates, sessions)
  const ics = dates.map((d) => d.ic)
  const spreads = dates.map((d) => d.spread)
  const tops = dates.map((d) => d.topExcess).filter((v): v is number => v != null)
  const bottoms = dates.map((d) => d.bottomExcess).filter((v): v is number => v != null)
  const pillarIc: Partial<Record<PillarKey, number>> = {}
  for (const k of PILLARS) {
    const v = dates.map((d) => d.pillarIc[k]).filter((x): x is number => x != null)
    if (v.length) pillarIc[k] = round(mean(v), 3)
  }
  return {
    nDates: dates.length,
    independent: {
      n: indep.length,
      icPositive: indep.filter((d) => d.ic > 0).length,
      spreadPositive: indep.filter((d) => d.spread > 0).length,
      meanIc: round(mean(indep.map((d) => d.ic)), 3),
    },
    firstDate: dates[0]?.date ?? null,
    lastDate: dates[dates.length - 1]?.date ?? null,
    avgNames: Math.round(mean(dates.map((d) => d.n))),
    meanIc: round(mean(ics), 3),
    datesIcPositive: ics.filter((v) => v > 0).length,
    medianSpread: round(median(spreads)),
    datesSpreadPositive: spreads.filter((v) => v > 0).length,
    meanTopExcess: tops.length ? round(mean(tops)) : null,
    meanBottomExcess: bottoms.length ? round(mean(bottoms)) : null,
    pillarIc,
  }
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

main()
