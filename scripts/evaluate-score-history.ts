/**
 * Mesure des notes sur plusieurs années, à partir de notes reconstituées.
 * Run: npx tsx scripts/evaluate-score-history.ts   (après scripts/fetch-annual-fundamentals.ts)
 *
 * Le site ne conserve ses données que depuis avril 2026. Pour remonter plus loin, on reconstitue
 * ce que chaque action aurait montré à une date passée, avec :
 *   - les comptes du dernier exercice déjà publié à cette date (clos au moins PUBLICATION_LAG_DAYS avant),
 *   - les cours jusqu'à cette date,
 * puis on lui applique la notation actuelle et on regarde ce que l'action a fait ensuite.
 *
 * Limites, rappelées à l'affichage :
 *   - la date de publication des comptes est supposée, pas connue ;
 *   - les prévisions d'analystes de l'époque n'existent plus : le critère qui s'en sert n'est pas compté ;
 *   - l'univers est celui d'aujourd'hui (les sociétés disparues entre-temps n'y sont pas) ;
 *   - secteur, pays et taux de change sont ceux d'aujourd'hui.
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { computeScore, type PillarKey } from "../src/lib/scoring.ts"
import { getStockRegion } from "../src/lib/market.ts"
import { toPriceFilename } from "../src/lib/tickerFilename.ts"
import { FALLBACK_FX_RATES, normalizeCurrency, toEur, type FxRates } from "../src/lib/fx.ts"
import type { PriceCandle, Stock } from "../src/types/stock.ts"
import { enrichWithTechnicals } from "./technicals.ts"
import { PILLARS, evaluateDate, summarize, type DateResult, type Row } from "./score-stats.ts"
import type { AnnualFundamentalsFile, AnnualStatement } from "./fetch-annual-fundamentals.ts"

const ROOT = process.cwd()
const STOCKS_PATH = path.join(ROOT, "public", "data", "stocks.json")
const PRICES_DIR = path.join(ROOT, "public", "data", "prices")
const FUNDAMENTALS_PATH = path.join(ROOT, "scripts", "data", "annual-fundamentals.json")
const OUT_PATH = path.join(ROOT, "public", "data", "score-evaluation-history.json")

/** Délai supposé entre la clôture d'un exercice et la publication de ses comptes */
export const PUBLICATION_LAG_DAYS = 120
/** Horizons mesurés, en séances de Bourse (environ six mois et un an) */
const HORIZONS = [126, 252]
/** Séances de cours nécessaires avant la date pour calculer la tendance */
const MIN_PRICE_HISTORY = 200
export const LARGE_CAP_EUR = 1e9
const DAY_MS = 86_400_000

// Devises de comptes absentes des taux du site (valeur en euros d'une unité, ordre de grandeur)
export const EXTRA_FX: FxRates = { CNY: 0.126, TWD: 0.028, KRW: 0.00066, SGD: 0.68, INR: 0.011, BRL: 0.16, MXN: 0.05, ZAR: 0.05, ILS: 0.25, PLN: 0.23, CZK: 0.04, HUF: 0.0025 }

/** Deux fois par an : en mai (comptes de l'année précédente publiés) et en novembre. */
export function evaluationDates(firstCandle: string, lastCandle: string): string[] {
  const dates: string[] = []
  for (let year = Number(firstCandle.slice(0, 4)); year <= Number(lastCandle.slice(0, 4)); year++) {
    for (const month of ["05", "11"]) dates.push(`${year}-${month}-02`)
  }
  return dates.filter((d) => d > firstCandle && d < lastCandle)
}

export function loadCandles(ticker: string): PriceCandle[] | null {
  const p = path.join(PRICES_DIR, `${toPriceFilename(ticker)}.json`)
  if (!fs.existsSync(p)) return null
  try {
    return (JSON.parse(fs.readFileSync(p, "utf8")).candles ?? []) as PriceCandle[]
  } catch {
    return null
  }
}

const pct = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? (a / b) * 100 : null)
const growth = (cur: number | null, prev: number | null) => (cur != null && prev != null && prev > 0 ? (cur / prev - 1) * 100 : null)

/**
 * Ce que le site aurait affiché pour cette action à la date donnée, ou null si les données manquent.
 * Renvoie aussi l'indice de la séance correspondante, pour calculer ensuite le rendement.
 */
export function reconstruct(
  today: Stock, statements: AnnualStatement[], financialCurrency: string | undefined,
  candles: PriceCandle[], date: string, fx: FxRates,
): { stock: Stock; index: number } | null {
  // Dernière séance à la date ou avant
  let index = -1
  for (let i = candles.length - 1; i >= 0; i--) if (candles[i].date <= date) { index = i; break }
  if (index < MIN_PRICE_HISTORY) return null
  const history = candles.slice(0, index + 1)
  const price = history[index].close
  if (!(price > 0)) return null

  // Dernier exercice dont les comptes étaient déjà publiés
  const cutoff = new Date(Date.parse(date) - PUBLICATION_LAG_DAYS * DAY_MS).toISOString().slice(0, 10)
  const known = statements.filter((s) => s.periodEnd <= cutoff)
  const cur = known[known.length - 1]
  if (!cur) return null
  // Comptes trop anciens : la société n'a plus publié, la reconstitution n'aurait pas de sens
  if ((Date.parse(date) - Date.parse(cur.periodEnd)) / DAY_MS > 500) return null
  const prev = known.length >= 2 ? known[known.length - 2] : null
  const prevIsYearBefore = prev != null && Math.abs((Date.parse(cur.periodEnd) - Date.parse(prev.periodEnd)) / DAY_MS - 365) < 40

  // Passage du cours à la capitalisation. Le rapport entre la capitalisation d'aujourd'hui et
  // « cours × nombre d'actions » capte les particularités de cotation (cours en pence à Londres,
  // plusieurs catégories d'actions) ; on le suppose stable dans le temps.
  const latest = statements[statements.length - 1]
  let capFactor = today.currency === "GBp" ? 0.01 : 1
  if (today.marketCap && today.price && latest.shares) {
    const observed = today.marketCap / (today.price * latest.shares)
    if (observed > 0.002 && observed < 500) capFactor = observed
  }
  const marketCap = cur.shares ? price * cur.shares * capFactor : null

  // Conversion des comptes vers la devise de cotation (taux d'aujourd'hui)
  const tradeCcy = normalizeCurrency(today.currency)
  const finCcy = financialCurrency ?? tradeCcy
  const rate = (c: string) => fx[c] ?? FALLBACK_FX_RATES[c] ?? EXTRA_FX[c]
  const conv = finCcy === tradeCcy ? 1 : rate(finCcy) && rate(tradeCcy) ? rate(finCcy) / rate(tradeCcy) : null
  const inTrade = (v: number | null) => (v != null && conv != null ? v * conv : null)

  const netIncome = inTrade(cur.netIncome)
  const equity = inTrade(cur.equity)
  const debt = inTrade(cur.totalDebt)
  const cash = inTrade(cur.cash)
  const ebitda = inTrade(cur.ebitda)
  const enterpriseValue = marketCap != null && debt != null && cash != null ? marketCap + debt - cash : null

  // Dividende : total par action de la dernière année civile entière avant la date
  const year = Number(date.slice(0, 4))
  const dividendHistory = (today.dividendHistory ?? []).filter((d) => d.year < year)
  const lastDividend = dividendHistory.find((d) => d.year === year - 1)?.total ?? 0
  const dividendsTotal = cur.shares ? lastDividend * cur.shares * capFactor : null

  const stock: Stock = {
    ticker: today.ticker, name: today.name, exchange: today.exchange, currency: today.currency,
    country: today.country, sector: today.sector, industry: today.industry,
    price, priceChange: null, priceChangePercent: null,
    marketCap,
    marketCapEur: toEur(marketCap, today.currency, fx),
    trailingPE: marketCap != null && netIncome != null && netIncome !== 0 ? marketCap / netIncome : null,
    forwardPE: null, // les prévisions d'analystes de l'époque ne sont pas disponibles
    priceToBook: marketCap != null && equity != null && equity > 0 ? marketCap / equity : null,
    enterpriseValue,
    evToEbitda: enterpriseValue != null && ebitda != null && ebitda > 0 ? enterpriseValue / ebitda : null,
    returnOnEquity: cur.equity != null && cur.equity > 0 ? pct(cur.netIncome, cur.equity) : null,
    returnOnAssets: pct(cur.netIncome, cur.totalAssets),
    profitMargins: cur.revenue != null && cur.revenue > 0 ? pct(cur.netIncome, cur.revenue) : null,
    operatingMargins: cur.revenue != null && cur.revenue > 0 ? pct(cur.operatingIncome, cur.revenue) : null,
    revenueGrowth: prevIsYearBefore ? growth(cur.revenue, prev!.revenue) : null,
    earningsGrowth: prevIsYearBefore ? (growth(cur.eps, prev!.eps) ?? growth(cur.netIncome, prev!.netIncome)) : null,
    totalDebt: debt, totalCash: cash,
    debtToEquity: cur.equity != null && cur.equity > 0 ? pct(cur.totalDebt, cur.equity) : null,
    dividendYield: (lastDividend / price) * 100,
    payoutRatio: dividendsTotal != null && netIncome != null && netIncome > 0 ? (dividendsTotal / netIncome) * 100 : null,
    description: null, employees: null, website: null,
    fiftyTwoWeekHigh: Math.max(...history.slice(-252).map((c) => c.high ?? c.close)),
    fiftyTwoWeekLow: Math.min(...history.slice(-252).map((c) => c.low ?? c.close)),
    rsi14: null, sma50: null, sma200: null, priceVsSma50: null, priceVsSma200: null,
    perf1M: null, perf3M: null, perf6M: null, perf1Y: null,
    indices: today.indices ?? [],
    annualFinancials: known.slice(-4).map((s) => ({ year: Number(s.periodEnd.slice(0, 4)), revenue: s.revenue, netIncome: s.netIncome })),
    dividendHistory,
    peaEligible: today.peaEligible,
    fetchedAt: date,
  }
  enrichWithTechnicals(stock, history)
  return { stock, index }
}

function main() {
  if (!fs.existsSync(FUNDAMENTALS_PATH)) {
    console.error("❌ scripts/data/annual-fundamentals.json introuvable : lancer d'abord scripts/fetch-annual-fundamentals.ts")
    process.exit(1)
  }
  const dataset = JSON.parse(fs.readFileSync(STOCKS_PATH, "utf8"))
  const todayStocks = dataset.stocks as Stock[]
  const fx: FxRates = dataset.fxRates ?? FALLBACK_FX_RATES
  const fundamentals = JSON.parse(fs.readFileSync(FUNDAMENTALS_PATH, "utf8")) as AnnualFundamentalsFile

  const candlesByTicker = new Map<string, PriceCandle[]>()
  for (const s of todayStocks) {
    const candles = loadCandles(s.ticker)
    if (candles && candles.length > 0 && fundamentals.statements[s.ticker]) candlesByTicker.set(s.ticker, candles)
  }
  const reference = candlesByTicker.get("MC.PA") ?? [...candlesByTicker.values()][0]
  const dates = evaluationDates(reference[0].date, reference[reference.length - 1].date)
  console.log(`📚 ${candlesByTicker.size} actions avec comptes et cours · dates : ${dates.join(", ")}`)

  const universes = {
    pea: "Actions éligibles au PEA",
    peaLarge: "Éligibles au PEA de plus d'un milliard d'euros",
    peaSmall: "Éligibles au PEA de moins d'un milliard d'euros",
    all: "Toutes les actions",
  } as const
  type UniverseId = keyof typeof universes
  const ids = Object.keys(universes) as UniverseId[]
  const perDate = Object.fromEntries(ids.map((u) => [u, Object.fromEntries(HORIZONS.map((h) => [h, [] as DateResult[]]))])) as Record<UniverseId, Record<number, DateResult[]>>

  for (const date of dates) {
    const rebuilt: { stock: Stock; index: number; candles: PriceCandle[] }[] = []
    for (const today of todayStocks) {
      const candles = candlesByTicker.get(today.ticker)
      if (!candles) continue
      const r = reconstruct(today, fundamentals.statements[today.ticker], fundamentals.financialCurrency?.[today.ticker], candles, date, fx)
      if (r) rebuilt.push({ ...r, candles })
    }
    const universe = rebuilt.map((r) => r.stock)
    if (universe.length < 100) { console.log(`  ${date} : ${universe.length} actions reconstituées, date ignorée`); continue }

    const scored = rebuilt.map((r) => ({ ...r, score: computeScore(r.stock, universe) }))
    const done: string[] = []
    for (const h of HORIZONS) {
      const rows = Object.fromEntries(ids.map((u) => [u, [] as Row[]])) as Record<UniverseId, Row[]>
      for (const { stock, index, candles, score } of scored) {
        // Entrée à la séance qui suit la date de la note, sortie `h` séances plus tard
        const entry = index + 1
        const exit = entry + h
        if (exit >= candles.length) continue
        const a = candles[entry].close, b = candles[exit].close
        if (!(a > 0) || !Number.isFinite(b)) continue
        const row: Row = {
          total: score.total, pillars: score.pillars, ret: (b / a - 1) * 100,
          counted: Object.fromEntries(PILLARS.map((k) => [k, score.explanations[k].counted])) as Record<PillarKey, boolean>,
        }
        rows.all.push(row)
        if (stock.peaEligible && getStockRegion(stock) === "eu") {
          rows.pea.push(row)
          if ((stock.marketCapEur ?? 0) >= LARGE_CAP_EUR) rows.peaLarge.push(row)
          else if (stock.marketCapEur != null) rows.peaSmall.push(row)
        }
      }
      for (const u of ids) {
        const res = evaluateDate(date, rows[u])
        if (res) perDate[u][h].push(res)
      }
      done.push(`${h} séances : ${rows.all.length} actions`)
    }
    console.log(`  ${date} : ${universe.length} notes reconstituées (${done.join(", ")})`)
  }

  const output = {
    generatedAt: new Date().toISOString(),
    method: "Note reconstituée à chaque date à partir des comptes du dernier exercice supposé publié et des cours de l'époque, puis comparée au rendement des séances suivantes.",
    publicationLagDays: PUBLICATION_LAG_DAYS,
    universes: ids.map((u) => ({
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
      console.log(`${u.label} · ${h.sessions} séances : ${s.nDates} dates (${s.independent.n} distinctes, écart positif ${s.independent.spreadPositive}), ${s.avgNames} actions, lien moyen ${s.meanIc} (positif ${s.datesIcPositive}/${s.nDates}), écart médian haut/bas ${s.medianSpread} pt, ≥7 : ${s.meanTopExcess} pt, <5 : ${s.meanBottomExcess} pt`)
      console.log(`   par critère : ${JSON.stringify(s.pillarIc)}`)
    }
  }
}

// Lancé directement (et non importé par un autre script)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
