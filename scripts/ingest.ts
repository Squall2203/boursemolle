import { writeFile, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YahooFinance from "yahoo-finance2"
import type { Stock, StocksDataset, StockPriceHistory, PriceCandle, AnnualFinancial, AnnualDividend } from "../src/types/stock.ts"
import { UNIVERSE } from "./universe.ts"
import { toPriceFilename } from "../src/lib/tickerFilename.ts"
import { getStockRegion } from "../src/lib/market.ts"
import { detectSmaCross } from "../src/lib/smaCross.ts"
import { FALLBACK_FX_RATES, normalizeCurrency, toEur, type FxRates } from "../src/lib/fx.ts"

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.resolve(__dirname, "../public/data/stocks.json")
const MACRO_PATH  = path.resolve(__dirname, "../public/data/macro.json")
const PRICES_DIR  = path.resolve(__dirname, "../public/data/prices")
const ML_PREDICTIONS_PATH = path.resolve(__dirname, "../public/data/picks/us_predictions.json")

/**
 * Notes du modèle statistique américain (ticker → note sur 10), publiées par scripts/ml.
 * Ignorées si elles datent de plus d'un mois : une note périmée ne doit pas peser dans le classement.
 */
async function loadMlScores(): Promise<Record<string, number>> {
  try {
    const pred = JSON.parse(await readFile(ML_PREDICTIONS_PATH, "utf-8")) as { period?: string; validated?: boolean; scores?: Record<string, number> }
    if (!pred.scores || !pred.period) return {}
    if (pred.validated !== true) {
      console.log("  notes ML ignorées : modèle non validé par son évaluation")
      return {}
    }
    const now = new Date()
    const months = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
    const [y, m] = pred.period.split("-").map(Number)
    const age = months(now) - (y * 12 + (m - 1))
    if (age < 0 || age > 1) {
      console.log(`  notes ML ignorées : prédictions de ${pred.period}`)
      return {}
    }
    return pred.scores
  } catch {
    return {}
  }
}

const EEE_COUNTRIES = new Set([
  "France", "Germany", "Netherlands", "Belgium", "Luxembourg",
  "Portugal", "Spain", "Italy", "Ireland", "Austria", "Finland",
  "Sweden", "Denmark", "Greece", "Czech Republic", "Poland",
  "Hungary", "Slovakia", "Slovenia", "Estonia", "Latvia",
  "Lithuania", "Malta", "Cyprus", "Bulgaria", "Romania", "Croatia",
  "Iceland", "Liechtenstein", "Norway",
])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pct(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null
  return Math.round(n * 10000) / 100
}

function num(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null
  return n
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Technical indicator computations ───

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return round2(slice.reduce((a, b) => a + b, 0) / period)
}

function computeRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null

  // Wilder's initial averages over first `period` changes
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing for remaining bars
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return round2(100 - 100 / (1 + rs))
}

function computePerf(closes: number[], tradingDays: number): number | null {
  if (closes.length < tradingDays + 1) return null
  const current = closes[closes.length - 1]
  const past = closes[closes.length - 1 - tradingDays]
  return round2(((current - past) / past) * 100)
}

function enrichWithTechnicals(stock: Stock, candles: PriceCandle[]): void {
  const closes = candles.map((c) => c.close)
  if (closes.length < 20) return

  const currentPrice = closes[closes.length - 1]

  stock.rsi14 = computeRSI(closes)
  stock.sma50 = computeSMA(closes, 50)
  stock.sma200 = computeSMA(closes, 200)

  if (stock.sma50 != null) {
    stock.priceVsSma50 = round2(((currentPrice - stock.sma50) / stock.sma50) * 100)
  }
  if (stock.sma200 != null) {
    stock.priceVsSma200 = round2(((currentPrice - stock.sma200) / stock.sma200) * 100)
  }

  stock.perf1M = computePerf(closes, 21)
  stock.perf3M = computePerf(closes, 63)
  stock.perf6M = computePerf(closes, 126)
  stock.perf1Y = computePerf(closes, 252)
  stock.smaCross = detectSmaCross(closes)
}

// ─── Data fetching ───

async function fetchStock(ticker: string, indices: string[]): Promise<Stock | null> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
        "summaryProfile",
        "incomeStatementHistory",
      ],
    })

    const price = summary.price
    const detail = summary.summaryDetail
    const stats = summary.defaultKeyStatistics
    const fin = summary.financialData
    const profile = summary.assetProfile

    if (!price) {
      console.warn(`  ⚠ ${ticker}: no price module returned`)
      return null
    }

    const country = profile?.country ?? "Unknown"

    const annualFinancials: AnnualFinancial[] = (
      summary.incomeStatementHistory?.incomeStatementHistory ?? []
    )
      .filter((s: Record<string, unknown>) => s.endDate != null)
      .map((s: Record<string, unknown>) => ({
        year: (s.endDate as Date).getFullYear(),
        revenue: num(s.totalRevenue as number | null),
        netIncome: num(s.netIncome as number | null),
      }))
      .sort((a: AnnualFinancial, b: AnnualFinancial) => a.year - b.year)

    const stock: Stock = {
      ticker,
      name: price.longName ?? price.shortName ?? ticker,
      exchange: price.exchangeName ?? "",
      currency: price.currency ?? "EUR",
      country,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,

      price: num(price.regularMarketPrice),
      priceChange: num(price.regularMarketChange),
      priceChangePercent: pct(price.regularMarketChangePercent),

      marketCap: num(price.marketCap),
      trailingPE: num(detail?.trailingPE),
      forwardPE: num(stats?.forwardPE),
      priceToBook: num(stats?.priceToBook),
      enterpriseValue: num(stats?.enterpriseValue),
      evToEbitda: num(stats?.enterpriseToEbitda),

      returnOnEquity: pct(fin?.returnOnEquity),
      returnOnAssets: pct(fin?.returnOnAssets),
      profitMargins: pct(fin?.profitMargins),
      operatingMargins: pct(fin?.operatingMargins),

      revenueGrowth: pct(fin?.revenueGrowth),
      earningsGrowth: pct(fin?.earningsGrowth),

      totalDebt: num(fin?.totalDebt),
      totalCash: num(fin?.totalCash),
      debtToEquity: num(fin?.debtToEquity),

      dividendYield: pct(detail?.dividendYield),
      payoutRatio: pct(detail?.payoutRatio),

      description: profile?.longBusinessSummary ?? null,
      employees: num(profile?.fullTimeEmployees ?? null),
      website: profile?.website ?? null,

      fiftyTwoWeekHigh: num(detail?.fiftyTwoWeekHigh ?? null),
      fiftyTwoWeekLow: num(detail?.fiftyTwoWeekLow ?? null),

      rsi14: null,
      sma50: null,
      sma200: null,
      priceVsSma50: null,
      priceVsSma200: null,
      perf1M: null,
      perf3M: null,
      perf6M: null,
      perf1Y: null,

      annualFinancials,
      dividendHistory: [],

      indices,

      peaEligible: false, // renseigné juste après, une fois l'action construite
      fetchedAt: new Date().toISOString(),
      lastFundamentalsUpdate: new Date().toISOString(),
      refreshPriority: 2,
    }

    // Éligibilité PEA estimée : siège dans l'Espace économique européen ET cotation en Europe.
    // Le siège seul ne suffit pas : une société cotée uniquement à New York ou à Hong Kong avec un
    // siège à Dublin ou à Luxembourg n'est pas proposée dans un PEA par les courtiers.
    stock.peaEligible = EEE_COUNTRIES.has(country) && getStockRegion(stock) === "eu"

    return stock
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  ✗ ${ticker}: ${msg}`)
    return null
  }
}

interface PriceHistoryResult {
  history: StockPriceHistory
  dividends: AnnualDividend[]
}

async function fetchPriceHistory(
  ticker: string,
  currency: string,
): Promise<PriceHistoryResult | null> {
  try {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    const result = await yahooFinance.chart(ticker, {
      period1: fiveYearsAgo.toISOString().split("T")[0],
      interval: "1d",
    })

    const quotes = result.quotes
    if (!quotes || quotes.length === 0) return null

    const candles: PriceCandle[] = quotes
      .filter(
        (q: Record<string, unknown>) =>
          q.open != null && q.high != null && q.low != null && q.close != null,
      )
      .map((q: Record<string, unknown>) => ({
        date: (q.date as Date).toISOString().split("T")[0],
        open: Math.round((q.open as number) * 100) / 100,
        high: Math.round((q.high as number) * 100) / 100,
        low: Math.round((q.low as number) * 100) / 100,
        close: Math.round((q.close as number) * 100) / 100,
        volume: Math.round(q.volume as number),
      }))

    const divEvents = result.events?.dividends ?? []
    const divByYear = new Map<number, number>()
    for (const ev of divEvents) {
      const year = (ev.date as Date).getFullYear()
      divByYear.set(year, (divByYear.get(year) ?? 0) + round2(ev.amount as number))
    }
    const dividends: AnnualDividend[] = [...divByYear.entries()]
      .map(([year, total]) => ({ year, total: round2(total) }))
      .sort((a, b) => a.year - b.year)

    return { history: { ticker, currency, candles }, dividends }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`    price history error: ${msg}`)
    return null
  }
}

// ─── Macro indicators ────────────────────────────────────────────────────────

export interface MacroItem {
  value: number
  change: number
  changePercent: number
  label: string
  static?: true
}

export interface MacroData {
  generatedAt: string
  cac40:  MacroItem | null
  sp500:  MacroItem | null
  eurusd: MacroItem | null
  brent:  MacroItem | null
  us10y:  MacroItem | null
  bce:    MacroItem
  eurgbp: MacroItem | null
  eursek: MacroItem | null
}

const MACRO_TICKERS: Array<{ key: keyof MacroData; ticker: string; label: string }> = [
  { key: "cac40",  ticker: "^FCHI",    label: "CAC 40"   },
  { key: "sp500",  ticker: "^GSPC",    label: "S&P 500"  },
  { key: "eurusd", ticker: "EURUSD=X", label: "EUR/USD"  },
  { key: "brent",  ticker: "BZ=F",     label: "Brent"    },
  { key: "us10y",  ticker: "^TNX",     label: "US 10Y"   },
  { key: "eurgbp", ticker: "EURGBP=X", label: "EUR/GBP"  },
  { key: "eursek", ticker: "EURSEK=X", label: "EUR/SEK"  },
]

async function fetchMacro(): Promise<MacroData> {
  const data: MacroData = {
    generatedAt: new Date().toISOString(),
    cac40: null, sp500: null, eurusd: null, brent: null, us10y: null,
    bce: { value: 2.40, change: 0, changePercent: 0, label: "Taux BCE", static: true },
    eurgbp: null, eursek: null,
  }

  for (const { key, ticker, label } of MACRO_TICKERS) {
    try {
      const q = await yahooFinance.quote(ticker)
      ;(data as Record<string, MacroItem | null>)[key] = {
        value:         round2(q.regularMarketPrice          ?? 0),
        change:        round2(q.regularMarketChange         ?? 0),
        changePercent: round2(q.regularMarketChangePercent  ?? 0),
        label,
      }
      process.stdout.write(`  macro ${ticker.padEnd(12)} ✓ ${q.regularMarketPrice?.toFixed(2)}\n`)
    } catch (err) {
      console.warn(`  macro ${ticker}: ${err instanceof Error ? err.message : err}`)
    }
    await sleep(200)
  }

  return data
}

// ─── Taux de change (pour exprimer toutes les capitalisations en euros) ─────

async function fetchFxRates(currencies: string[]): Promise<FxRates> {
  const rates: FxRates = { EUR: 1 }
  for (const c of currencies) {
    if (c === "EUR") continue
    try {
      // EURXXX=X = nombre d'unités de XXX pour 1 euro → on stocke l'inverse
      const q = await yahooFinance.quote(`EUR${c}=X`)
      const perEur = q.regularMarketPrice
      if (perEur != null && perEur > 0) {
        rates[c] = Math.round((1 / perEur) * 1e6) / 1e6
        process.stdout.write(`  fx EUR${c.padEnd(4)} ✓ ${perEur.toFixed(4)}\n`)
        continue
      }
    } catch (err) {
      console.warn(`  fx ${c}: ${err instanceof Error ? err.message : err}`)
    }
    if (FALLBACK_FX_RATES[c] != null) {
      rates[c] = FALLBACK_FX_RATES[c]
      console.warn(`  fx ${c}: taux de secours utilisé (${rates[c]})`)
    }
    await sleep(200)
  }
  return rates
}

async function main() {
  console.log(`Fetching ${UNIVERSE.length} tickers from Yahoo Finance...\n`)

  const results: Stock[] = []
  const failures: string[] = []

  for (const { ticker, expectedName, indices } of UNIVERSE) {
    process.stdout.write(`  ${ticker.padEnd(12)} ${expectedName.padEnd(22)} ... `)
    const stock = await fetchStock(ticker, indices)
    if (stock) {
      results.push(stock)
      const mc = stock.marketCap ? `${(stock.marketCap / 1e9).toFixed(1)}B` : "?"
      const idx = indices.length > 0 ? ` [${indices.join(", ")}]` : ""
      console.log(`✓ ${mc} ${stock.currency}${idx}`)
    } else {
      failures.push(ticker)
      console.log("✗")
    }
    await sleep(150)
  }

  console.log(
    `\n${results.length}/${UNIVERSE.length} fetched successfully, ${failures.length} failures.`,
  )
  if (failures.length > 0) {
    console.log("Failed tickers:", failures.join(", "))
  }

  console.log(`\nFetching price history (5 years) + computing technicals...\n`)
  await mkdir(PRICES_DIR, { recursive: true })
  let priceSuccesses = 0
  const recentCandles = new Map<string, PriceCandle[]>()
  for (const stock of results) {
    process.stdout.write(`  ${stock.ticker.padEnd(12)} prices ... `)
    const result = await fetchPriceHistory(stock.ticker, stock.currency)
    if (result && result.history.candles.length > 0) {
      const filePath = path.join(PRICES_DIR, `${toPriceFilename(stock.ticker)}.json`)
      await writeFile(filePath, JSON.stringify(result.history), "utf-8")
      enrichWithTechnicals(stock, result.history.candles)
      recentCandles.set(stock.ticker, result.history.candles.slice(-60))
      stock.dividendHistory = result.dividends
      const rsi = stock.rsi14 != null ? `RSI=${stock.rsi14}` : ""
      const divYears = result.dividends.length > 0 ? ` div=${result.dividends.length}y` : ""
      console.log(`✓ ${result.history.candles.length} candles ${rsi}${divYears}`)
      priceSuccesses++
    } else {
      console.log("✗")
    }
    await sleep(150)
  }
  console.log(`\n${priceSuccesses}/${results.length} price histories fetched.`)

  // ─── Index coverage report ───
  const indexCounts: Record<string, number> = {}
  for (const stock of results) {
    for (const idx of stock.indices) {
      indexCounts[idx] = (indexCounts[idx] ?? 0) + 1
    }
  }
  console.log(`\nIndex coverage:`)
  for (const [idx, count] of Object.entries(indexCounts).sort()) {
    console.log(`  ${idx.padEnd(15)} ${count}`)
  }

  const missingMarketCap = results.filter((s) => !s.marketCap)
  const missingPE = results.filter((s) => !s.trailingPE)
  const missingROE = results.filter((s) => !s.returnOnEquity)
  const missingSector = results.filter((s) => !s.sector)
  const missingRSI = results.filter((s) => s.rsi14 == null)
  console.log(`\nData quality:`)
  console.log(`  missing marketCap : ${missingMarketCap.length}`)
  console.log(`  missing trailingPE: ${missingPE.length}`)
  console.log(`  missing ROE       : ${missingROE.length}`)
  console.log(`  missing sector    : ${missingSector.length}`)
  console.log(`  missing RSI       : ${missingRSI.length}`)

  console.log(`\nFetching FX rates...\n`)
  const currencies = [...new Set(results.map((s) => normalizeCurrency(s.currency)))].sort()
  const fxRates = await fetchFxRates(currencies)
  for (const stock of results) {
    const eur = toEur(stock.marketCap, stock.currency, fxRates)
    stock.marketCapEur = eur != null ? Math.round(eur) : null

    // Montant moyen échangé par séance (60 dernières séances), en euros : sert de mesure de liquidité
    const candles = recentCandles.get(stock.ticker)
    if (candles && candles.length >= 20) {
      const avg = candles.reduce((sum, c) => sum + c.close * (c.volume || 0), 0) / candles.length
      const dailyEur = toEur(stock.currency === "GBp" ? avg / 100 : avg, stock.currency, fxRates)
      stock.avgDailyValueEur = dailyEur != null ? Math.round(dailyEur) : null
    }
  }

  const mlScores = await loadMlScores()
  let mlCount = 0
  for (const stock of results) {
    const score = mlScores[stock.ticker]
    if (score != null) { stock.mlScore = score; mlCount++ }
  }
  console.log(`  notes ML appliquées : ${mlCount}`)

  const dataset: StocksDataset = {
    generatedAt: new Date().toISOString(),
    count: results.length,
    fxRates,
    stocks: results,
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(dataset, null, 2), "utf-8")
  console.log(`\n✓ Wrote ${OUTPUT_PATH} (${results.length} stocks)`)

  console.log(`\nFetching macro indicators...\n`)
  const macro = await fetchMacro()
  await writeFile(MACRO_PATH, JSON.stringify(macro, null, 2), "utf-8")
  console.log(`✓ Wrote ${MACRO_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
