/**
 * Essai : la note serait-elle meilleure avec la trésorerie dégagée dans le critère Valorisation,
 * ou avec d'autres poids entre les critères ?
 * Run: npx tsx scripts/experiments/score-variants.ts
 *
 * Ne modifie rien sur le site. Les variantes sont recalculées à partir du détail de la note actuelle,
 * sur les deux mesures existantes : notes reconstituées (3 ans) et versions hebdomadaires réelles.
 */
import fs from "node:fs"
import path from "node:path"
import { computeScore, type PillarKey, type StockScore } from "../../src/lib/scoring.ts"
import { getStockRegion } from "../../src/lib/market.ts"
import { FALLBACK_FX_RATES, normalizeCurrency, toEur, type FxRates } from "../../src/lib/fx.ts"
import type { PriceCandle, Stock } from "../../src/types/stock.ts"
import { PILLARS, evaluateDate, mean, median, round, type DateResult, type Row } from "../score-stats.ts"
import type { AnnualFundamentalsFile } from "../fetch-annual-fundamentals.ts"
import { EXTRA_FX, LARGE_CAP_EUR, PUBLICATION_LAG_DAYS, evaluationDates, loadCandles, reconstruct } from "../evaluate-score-history.ts"
import { forwardReturn, loadSnapshot, weeklySnapshots } from "../evaluate-score.ts"

const ROOT = process.cwd()
const DAY_MS = 86_400_000

type Weights = Record<PillarKey, number>
const CURRENT: Weights = { valorisation: 0.20, qualite: 0.20, croissance: 0.15, sante: 0.15, dividende: 0.10, momentum: 0.10, quant: 0.10 }
// Variantes fixées avant de regarder les résultats, pour ne pas ajuster les poids sur le passé
const WEIGHT_VARIANTS: Record<string, Weights> = {
  "poids actuels": CURRENT,
  "tendance +10 pts (modeste)": { valorisation: 0.20, qualite: 0.15, croissance: 0.15, sante: 0.10, dividende: 0.10, momentum: 0.15, quant: 0.15 },
  "tendance +20 pts (marqué)": { valorisation: 0.20, qualite: 0.15, croissance: 0.10, sante: 0.10, dividende: 0.05, momentum: 0.20, quant: 0.20 },
  "poids égaux": Object.fromEntries(PILLARS.map((k) => [k, 1 / 7])) as Weights,
}
/** Poids de la trésorerie dégagée dans le critère Valorisation (les autres chiffres gardent le leur, puis tout est ramené à 100 %) */
const FCF_WEIGHT = 0.30

const clamp = (v: number) => Math.max(0, Math.min(10, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/** Note globale recalculée avec d'autres poids et, au besoin, une autre note de valorisation. */
function total(score: StockScore, weights: Weights, valorisation?: { note: number; counted: boolean }): number {
  const counted = (k: PillarKey) => (k === "valorisation" && valorisation ? valorisation.counted : score.explanations[k].counted)
  const value = (k: PillarKey) => (k === "valorisation" && valorisation ? valorisation.note : score.pillars[k])
  const sum = PILLARS.reduce((s, k) => s + (counted(k) ? weights[k] : 0), 0)
  const raw = sum > 0 ? clamp(PILLARS.reduce((s, k) => s + (counted(k) ? value(k) * weights[k] : 0), 0) / sum) : 5
  const confidence = Math.min(1, score.dataCoverage / 0.8)
  return round1(5 + (raw - 5) * confidence)
}

/** Critère Valorisation recalculé en y ajoutant la note de trésorerie dégagée. */
function valorisationWithFcf(score: StockScore, fcfNote: number | null): { note: number; counted: boolean } {
  let weighted = 0, used = 0
  for (const m of Object.values(score.details.valorisation)) {
    if (m.excluded || m.missing) continue
    weighted += m.note * m.weight
    used += m.weight
  }
  if (fcfNote != null) { weighted += fcfNote * FCF_WEIGHT; used += FCF_WEIGHT }
  return { note: used > 0 ? round1(clamp(weighted / used)) : 5, counted: used > 0 }
}

/** Position (0 à 10) dans le groupe ; les ex æquo comptent pour moitié. Même règle que la notation du site. */
function rankNote(value: number, group: number[]): number {
  let below = 0, equal = 0
  for (const v of group) { if (v < value) below++; else if (v === value) equal++ }
  return clamp(Math.round(((below + equal / 2) / group.length) * 100) / 10)
}

interface Item { stock: Stock; score: StockScore; rets: Record<number, number | null>; fcfYield: number | null; fcfNote: number | null }
type UniverseId = "pea" | "peaLarge" | "peaSmall" | "all"
const UNIVERSES: UniverseId[] = ["pea", "peaLarge", "peaSmall", "all"]

function inUniverse(s: Stock, u: UniverseId): boolean {
  if (u === "all") return true
  if (!(s.peaEligible && getStockRegion(s) === "eu")) return false
  const cap = s.marketCapEur ?? toEur(s.marketCap, s.currency)
  if (u === "pea") return true
  if (u === "peaLarge") return (cap ?? 0) >= LARGE_CAP_EUR
  return cap != null && cap < LARGE_CAP_EUR
}

type Variant = (it: Item) => number | null
type Results = Record<string, Record<UniverseId, Record<number, DateResult[]>>>

function evaluateVariants(date: string, items: Item[], horizons: number[], variants: Record<string, Variant>, out: Results, restrict?: (it: Item) => boolean) {
  for (const [name, fn] of Object.entries(variants)) {
    for (const u of UNIVERSES) {
      for (const h of horizons) {
        const rows: Row[] = []
        for (const it of items) {
          if (restrict && !restrict(it)) continue
          const ret = it.rets[h]
          const t = fn(it)
          if (ret == null || t == null || !inUniverse(it.stock, u)) continue
          rows.push({ total: t, pillars: it.score.pillars, ret, counted: Object.fromEntries(PILLARS.map((k) => [k, it.score.explanations[k].counted])) as Record<PillarKey, boolean> })
        }
        const res = evaluateDate(date, rows)
        if (res) (((out[name] ??= {} as Results[string])[u] ??= {})[h] ??= []).push(res)
      }
    }
  }
}

function report(title: string, out: Results, horizons: number[], universes: UniverseId[], baseline: string) {
  console.log(`\n═══ ${title} ═══`)
  for (const u of universes) {
    for (const h of horizons) {
      const base = out[baseline]?.[u]?.[h]
      if (!base) continue
      console.log(`\n${u} · ${h} séances · ${base.length} dates · ~${Math.round(mean(base.map((d) => d.n)))} actions`)
      console.log("  variante".padEnd(34) + "lien moyen  lien>0   écart haut/bas (médian / moyen)   écart>0   mieux que l'actuelle (lien / écart)")
      for (const [name, byU] of Object.entries(out)) {
        const d = byU[u]?.[h]
        if (!d) continue
        const byDate = new Map(base.map((b) => [b.date, b]))
        const common = d.filter((x) => byDate.has(x.date))
        const betterIc = common.filter((x) => x.ic > byDate.get(x.date)!.ic).length
        const betterSp = common.filter((x) => x.spread > byDate.get(x.date)!.spread).length
        console.log(
          `  ${name.padEnd(32)}${String(round(mean(d.map((x) => x.ic)), 3)).padEnd(12)}${`${d.filter((x) => x.ic > 0).length}/${d.length}`.padEnd(9)}` +
          `${`${round(median(d.map((x) => x.spread)))} / ${round(mean(d.map((x) => x.spread)))}`.padEnd(34)}${`${d.filter((x) => x.spread > 0).length}/${d.length}`.padEnd(10)}` +
          (name === baseline ? "" : `${betterIc}/${common.length} / ${betterSp}/${common.length}`),
        )
      }
    }
  }
}

// ─── 1. Notes reconstituées (3 ans) ──────────────────────────────────────────

function reconstructed() {
  const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/stocks.json"), "utf8"))
  const todayStocks = dataset.stocks as Stock[]
  const fx: FxRates = dataset.fxRates ?? FALLBACK_FX_RATES
  const fundamentals = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/data/annual-fundamentals.json"), "utf8")) as AnnualFundamentalsFile
  const candlesByTicker = new Map<string, PriceCandle[]>()
  for (const s of todayStocks) {
    const c = loadCandles(s.ticker)
    if (c && c.length > 0 && fundamentals.statements[s.ticker]) candlesByTicker.set(s.ticker, c)
  }
  const reference = candlesByTicker.get("MC.PA")!
  const dates = evaluationDates(reference[0].date, reference[reference.length - 1].date)
  const HORIZONS = [126, 252]
  const rate = (c: string) => fx[c] ?? FALLBACK_FX_RATES[c] ?? EXTRA_FX[c]

  const weightsOut: Results = {}, fcfOut: Results = {}, fcfOnlyOut: Results = {}, metricOut: Results = {}
  let withFcf = 0, nonFin = 0

  for (const date of dates) {
    const rebuilt: { stock: Stock; index: number; candles: PriceCandle[]; fcfYield: number | null }[] = []
    for (const today of todayStocks) {
      const candles = candlesByTicker.get(today.ticker)
      if (!candles) continue
      const statements = fundamentals.statements[today.ticker]
      const r = reconstruct(today, statements, fundamentals.financialCurrency?.[today.ticker], candles, date, fx)
      if (!r) continue
      // Trésorerie dégagée du même exercice que celui retenu pour la note, rapportée à la capitalisation
      const cutoff = new Date(Date.parse(date) - PUBLICATION_LAG_DAYS * DAY_MS).toISOString().slice(0, 10)
      const cur = statements.filter((s) => s.periodEnd <= cutoff).at(-1)!
      const tradeCcy = normalizeCurrency(today.currency)
      const finCcy = fundamentals.financialCurrency?.[today.ticker] ?? tradeCcy
      const conv = finCcy === tradeCcy ? 1 : rate(finCcy) && rate(tradeCcy) ? rate(finCcy) / rate(tradeCcy) : null
      const fcfYield = cur.freeCashFlow != null && conv != null && r.stock.marketCap ? (cur.freeCashFlow * conv / r.stock.marketCap) * 100 : null
      rebuilt.push({ ...r, candles, fcfYield })
    }
    const universe = rebuilt.map((r) => r.stock)
    if (universe.length < 100) continue

    // Rang de la trésorerie dégagée parmi les sociétés de la même région et du même secteur (hors finance)
    const groups = new Map<string, number[]>()
    const groupKey = (s: Stock) => `${getStockRegion(s)}|${s.sector ?? "Unknown"}`
    for (const r of rebuilt) {
      if (r.fcfYield == null || r.stock.sector === "Financial Services") continue
      const g = groups.get(groupKey(r.stock)) ?? []
      g.push(r.fcfYield)
      groups.set(groupKey(r.stock), g)
    }

    const items: Item[] = rebuilt.map((r) => {
      const score = computeScore(r.stock, universe)
      const entry = r.index + 1
      const rets = Object.fromEntries(HORIZONS.map((h) => {
        const exit = entry + h
        const a = r.candles[entry]?.close, b = r.candles[exit]?.close
        return [h, exit < r.candles.length && a > 0 && Number.isFinite(b) ? (b / a - 1) * 100 : null]
      }))
      const group = groups.get(groupKey(r.stock))
      const isFin = r.stock.sector === "Financial Services"
      const fcfNote = !isFin && r.fcfYield != null && group && group.length >= 8 ? rankNote(r.fcfYield, group) : null
      if (!isFin) { nonFin++; if (fcfNote != null) withFcf++ }
      return { stock: r.stock, score, rets, fcfYield: r.fcfYield, fcfNote }
    })

    evaluateVariants(date, items, HORIZONS, Object.fromEntries(Object.entries(WEIGHT_VARIANTS).map(([n, w]) => [n, (it: Item) => total(it.score, w)])), weightsOut)
    evaluateVariants(date, items, HORIZONS, {
      "note actuelle": (it) => it.score.total,
      "avec trésorerie dégagée": (it) => total(it.score, CURRENT, valorisationWithFcf(it.score, it.fcfNote)),
      "trésorerie + tendance +10 pts": (it) => total(it.score, WEIGHT_VARIANTS["tendance +10 pts (modeste)"], valorisationWithFcf(it.score, it.fcfNote)),
    }, fcfOut)
    // Le critère Valorisation seul, avec et sans trésorerie, puis chaque chiffre isolé (sociétés hors finance ayant la donnée)
    const m = (it: Item, key: string) => { const d = it.score.details.valorisation[key]; return d && !d.excluded && !d.missing ? d.note : null }
    evaluateVariants(date, items, HORIZONS, {
      "Valorisation actuelle": (it) => (it.score.explanations.valorisation.counted ? it.score.pillars.valorisation : null),
      "Valorisation avec trésorerie": (it) => { const v = valorisationWithFcf(it.score, it.fcfNote); return v.counted ? v.note : null },
    }, fcfOnlyOut)
    evaluateVariants(date, items, HORIZONS, {
      "PER seul": (it) => m(it, "pe_vs_secteur"),
      "VE/EBITDA seul": (it) => m(it, "ev_ebitda"),
      "Cours/actif net seul": (it) => m(it, "pb"),
      "Trésorerie dégagée seule": (it) => it.fcfNote,
    }, metricOut, (it) => it.fcfNote != null)
  }

  console.log(`Trésorerie dégagée disponible pour ${withFcf} notes sur ${nonFin} (hors finance), soit ${Math.round((withFcf / nonFin) * 100)} %`)
  report("NOTES RECONSTITUÉES · chiffres de valorisation pris isolément", metricOut, HORIZONS, ["pea", "peaLarge", "peaSmall", "all"], "PER seul")
  report("NOTES RECONSTITUÉES · critère Valorisation", fcfOnlyOut, HORIZONS, ["pea", "peaLarge", "peaSmall", "all"], "Valorisation actuelle")
  report("NOTES RECONSTITUÉES · note globale, trésorerie dégagée", fcfOut, HORIZONS, ["pea", "peaLarge", "peaSmall", "all"], "note actuelle")
  report("NOTES RECONSTITUÉES · note globale, poids", weightsOut, HORIZONS, ["pea", "peaLarge", "peaSmall", "all"], "poids actuels")
}

// ─── 2. Versions hebdomadaires réelles (poids seulement : la trésorerie n'y figure pas) ──

function weekly() {
  const HORIZONS = [21, 63]
  const out: Results = {}
  for (const snap of weeklySnapshots()) {
    let stocks: Stock[]
    try { stocks = loadSnapshot(snap.sha) } catch { continue }
    const items: Item[] = stocks.map((s) => ({
      stock: s, score: computeScore(s, stocks), fcfYield: null, fcfNote: null,
      rets: Object.fromEntries(HORIZONS.map((h) => [h, forwardReturn(s.ticker, snap.date, h)])),
    }))
    evaluateVariants(snap.date, items, HORIZONS, Object.fromEntries(Object.entries(WEIGHT_VARIANTS).map(([n, w]) => [n, (it: Item) => total(it.score, w)])), out)
  }
  report("VERSIONS HEBDOMADAIRES RÉELLES · note globale, poids", out, HORIZONS, ["pea", "peaLarge", "peaSmall", "all"], "poids actuels")
}

reconstructed()
weekly()
