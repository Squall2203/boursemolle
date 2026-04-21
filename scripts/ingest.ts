import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YahooFinance from "yahoo-finance2"
import type { Stock, StocksDataset, StockPriceHistory, PriceCandle, AnnualFinancial, AnnualDividend } from "../src/types/stock.ts"
import { UNIVERSE } from "./universe.ts"
import { toPriceFilename } from "../src/lib/tickerFilename.ts"

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.resolve(__dirname, "../public/data/stocks.json")
const PRICES_DIR = path.resolve(__dirname, "../public/data/prices")

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
  let avgGain = 0
  let avgLoss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period
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

      peaEligible: EEE_COUNTRIES.has(country),
      fetchedAt: new Date().toISOString(),
      lastFundamentalsUpdate: new Date().toISOString(),
      refreshPriority: 2,
    }

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
  for (const stock of results) {
    process.stdout.write(`  ${stock.ticker.padEnd(12)} prices ... `)
    const result = await fetchPriceHistory(stock.ticker, stock.currency)
    if (result && result.history.candles.length > 0) {
      const filePath = path.join(PRICES_DIR, `${toPriceFilename(stock.ticker)}.json`)
      await writeFile(filePath, JSON.stringify(result.history), "utf-8")
      enrichWithTechnicals(stock, result.history.candles)
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

  const dataset: StocksDataset = {
    generatedAt: new Date().toISOString(),
    count: results.length,
    stocks: results,
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(dataset, null, 2), "utf-8")
  console.log(`\n✓ Wrote ${OUTPUT_PATH} (${results.length} stocks)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
