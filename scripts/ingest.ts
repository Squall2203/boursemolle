import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YahooFinance from "yahoo-finance2"
import type { Stock, StocksDataset, StockPriceHistory, PriceCandle } from "../src/types/stock.ts"

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.resolve(__dirname, "../public/data/stocks.json")
const PRICES_DIR = path.resolve(__dirname, "../public/data/prices")

const EEE_COUNTRIES = new Set([
  "France",
  "Germany",
  "Netherlands",
  "Belgium",
  "Luxembourg",
  "Portugal",
  "Spain",
  "Italy",
  "Ireland",
  "Austria",
  "Finland",
  "Sweden",
  "Denmark",
  "Greece",
  "Czech Republic",
  "Poland",
  "Hungary",
  "Slovakia",
  "Slovenia",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Malta",
  "Cyprus",
  "Bulgaria",
  "Romania",
  "Croatia",
  "Iceland",
  "Liechtenstein",
  "Norway",
])

const TICKERS: Array<{ ticker: string; expectedName: string }> = [
  // France — Euronext Paris (18)
  { ticker: "MC.PA", expectedName: "LVMH" },
  { ticker: "OR.PA", expectedName: "L'Oréal" },
  { ticker: "RMS.PA", expectedName: "Hermès" },
  { ticker: "AIR.PA", expectedName: "Airbus" },
  { ticker: "TTE.PA", expectedName: "TotalEnergies" },
  { ticker: "SAN.PA", expectedName: "Sanofi" },
  { ticker: "BNP.PA", expectedName: "BNP Paribas" },
  { ticker: "SU.PA", expectedName: "Schneider Electric" },
  { ticker: "CS.PA", expectedName: "AXA" },
  { ticker: "EL.PA", expectedName: "EssilorLuxottica" },
  { ticker: "KER.PA", expectedName: "Kering" },
  { ticker: "DG.PA", expectedName: "Vinci" },
  { ticker: "CAP.PA", expectedName: "Capgemini" },
  { ticker: "BN.PA", expectedName: "Danone" },
  { ticker: "ACA.PA", expectedName: "Crédit Agricole" },
  { ticker: "SAF.PA", expectedName: "Safran" },
  { ticker: "ML.PA", expectedName: "Michelin" },
  { ticker: "RI.PA", expectedName: "Pernod Ricard" },

  // Germany — Xetra (15)
  { ticker: "SAP.DE", expectedName: "SAP" },
  { ticker: "SIE.DE", expectedName: "Siemens" },
  { ticker: "ALV.DE", expectedName: "Allianz" },
  { ticker: "DTE.DE", expectedName: "Deutsche Telekom" },
  { ticker: "MUV2.DE", expectedName: "Munich Re" },
  { ticker: "BAS.DE", expectedName: "BASF" },
  { ticker: "BAYN.DE", expectedName: "Bayer" },
  { ticker: "BMW.DE", expectedName: "BMW" },
  { ticker: "MBG.DE", expectedName: "Mercedes-Benz" },
  { ticker: "VOW3.DE", expectedName: "Volkswagen" },
  { ticker: "DBK.DE", expectedName: "Deutsche Bank" },
  { ticker: "IFX.DE", expectedName: "Infineon" },
  { ticker: "ADS.DE", expectedName: "Adidas" },
  { ticker: "DHL.DE", expectedName: "DHL Group" },
  { ticker: "RWE.DE", expectedName: "RWE" },

  // Netherlands — Euronext Amsterdam (8)
  { ticker: "ASML.AS", expectedName: "ASML" },
  { ticker: "PRX.AS", expectedName: "Prosus" },
  { ticker: "ADYEN.AS", expectedName: "Adyen" },
  { ticker: "INGA.AS", expectedName: "ING Groep" },
  { ticker: "WKL.AS", expectedName: "Wolters Kluwer" },
  { ticker: "HEIA.AS", expectedName: "Heineken" },
  { ticker: "PHIA.AS", expectedName: "Philips" },
  { ticker: "RAND.AS", expectedName: "Randstad" },

  // Belgium — Euronext Brussels (4)
  { ticker: "ABI.BR", expectedName: "AB InBev" },
  { ticker: "KBC.BR", expectedName: "KBC Group" },
  { ticker: "SOLB.BR", expectedName: "Solvay" },
  { ticker: "UCB.BR", expectedName: "UCB" },

  // Portugal — Euronext Lisbon (2)
  { ticker: "EDP.LS", expectedName: "EDP" },
  { ticker: "GALP.LS", expectedName: "Galp Energia" },

  // Italy — Borsa Italiana (3)
  { ticker: "ENI.MI", expectedName: "Eni" },
  { ticker: "ISP.MI", expectedName: "Intesa Sanpaolo" },
  { ticker: "ENEL.MI", expectedName: "Enel" },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pct(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null
  return Math.round(n * 10000) / 100
}

function num(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null
  return n
}

async function fetchStock(ticker: string): Promise<Stock | null> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
        "summaryProfile",
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

      peaEligible: EEE_COUNTRIES.has(country),
      fetchedAt: new Date().toISOString(),
    }

    return stock
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  ✗ ${ticker}: ${msg}`)
    return null
  }
}

async function fetchPriceHistory(
  ticker: string,
  currency: string,
): Promise<StockPriceHistory | null> {
  try {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const result = await yahooFinance.chart(ticker, {
      period1: oneYearAgo.toISOString().split("T")[0],
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

    return { ticker, currency, candles }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`    price history error: ${msg}`)
    return null
  }
}

async function main() {
  console.log(`Fetching ${TICKERS.length} tickers from Yahoo Finance...\n`)

  const results: Stock[] = []
  const failures: string[] = []

  for (const { ticker, expectedName } of TICKERS) {
    process.stdout.write(`  ${ticker.padEnd(10)} ${expectedName.padEnd(22)} ... `)
    const stock = await fetchStock(ticker)
    if (stock) {
      results.push(stock)
      const mc = stock.marketCap ? `${(stock.marketCap / 1e9).toFixed(1)}B` : "?"
      console.log(`✓ ${mc} ${stock.currency}`)
    } else {
      failures.push(ticker)
      console.log("✗")
    }
    await sleep(150)
  }

  console.log(
    `\n${results.length}/${TICKERS.length} fetched successfully, ${failures.length} failures.`,
  )
  if (failures.length > 0) {
    console.log("Failed tickers:", failures.join(", "))
  }

  console.log(`\nFetching price history (1 year)...\n`)
  await mkdir(PRICES_DIR, { recursive: true })
  let priceSuccesses = 0
  for (const stock of results) {
    process.stdout.write(`  ${stock.ticker.padEnd(10)} prices ... `)
    const history = await fetchPriceHistory(stock.ticker, stock.currency)
    if (history && history.candles.length > 0) {
      const filePath = path.join(PRICES_DIR, `${stock.ticker}.json`)
      await writeFile(filePath, JSON.stringify(history), "utf-8")
      console.log(`✓ ${history.candles.length} candles`)
      priceSuccesses++
    } else {
      console.log("✗")
    }
    await sleep(150)
  }
  console.log(`\n${priceSuccesses}/${results.length} price histories fetched.`)

  const missingMarketCap = results.filter((s) => !s.marketCap)
  const missingPE = results.filter((s) => !s.trailingPE)
  const missingROE = results.filter((s) => !s.returnOnEquity)
  const missingSector = results.filter((s) => !s.sector)
  console.log(`\nData quality:`)
  console.log(`  missing marketCap : ${missingMarketCap.length}`)
  console.log(`  missing trailingPE: ${missingPE.length}`)
  console.log(`  missing ROE       : ${missingROE.length}`)
  console.log(`  missing sector    : ${missingSector.length}`)

  const dataset: StocksDataset = {
    generatedAt: new Date().toISOString(),
    count: results.length,
    stocks: results,
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(dataset, null, 2), "utf-8")
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
