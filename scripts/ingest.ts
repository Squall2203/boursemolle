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
  "France", "Germany", "Netherlands", "Belgium", "Luxembourg",
  "Portugal", "Spain", "Italy", "Ireland", "Austria", "Finland",
  "Sweden", "Denmark", "Greece", "Czech Republic", "Poland",
  "Hungary", "Slovakia", "Slovenia", "Estonia", "Latvia",
  "Lithuania", "Malta", "Cyprus", "Bulgaria", "Romania", "Croatia",
  "Iceland", "Liechtenstein", "Norway",
])

const TICKERS: Array<{ ticker: string; expectedName: string }> = [
  // ─── France — Euronext Paris (40) ───
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
  { ticker: "STM.PA", expectedName: "STMicroelectronics" },
  { ticker: "VIE.PA", expectedName: "Veolia" },
  { ticker: "STLAP.PA", expectedName: "Stellantis" },
  { ticker: "LR.PA", expectedName: "Legrand" },
  { ticker: "PUB.PA", expectedName: "Publicis" },
  { ticker: "GLE.PA", expectedName: "Société Générale" },
  { ticker: "TEP.PA", expectedName: "Teleperformance" },
  { ticker: "EN.PA", expectedName: "Bouygues" },
  { ticker: "SGO.PA", expectedName: "Saint-Gobain" },
  { ticker: "HO.PA", expectedName: "Thales" },
  { ticker: "WLN.PA", expectedName: "Worldline" },
  { ticker: "ERA.PA", expectedName: "Eramet" },
  { ticker: "ORA.PA", expectedName: "Orange" },
  { ticker: "URW.PA", expectedName: "Unibail-Rodamco" },
  { ticker: "VIV.PA", expectedName: "Vivendi" },
  { ticker: "DSY.PA", expectedName: "Dassault Systèmes" },
  { ticker: "RNO.PA", expectedName: "Renault" },
  { ticker: "ATO.PA", expectedName: "Atos" },
  { ticker: "SW.PA", expectedName: "Sodexo" },
  { ticker: "FP.PA", expectedName: "Faurecia / Forvia" },
  { ticker: "NK.PA", expectedName: "Imerys" },
  { ticker: "AM.PA", expectedName: "Dassault Aviation" },

  // ─── Germany — Xetra (35) ───
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
  { ticker: "HEN3.DE", expectedName: "Henkel" },
  { ticker: "FRE.DE", expectedName: "Fresenius" },
  { ticker: "MTX.DE", expectedName: "MTU Aero Engines" },
  { ticker: "SY1.DE", expectedName: "Symrise" },
  { ticker: "QIA.DE", expectedName: "Qiagen" },
  { ticker: "BEI.DE", expectedName: "Beiersdorf" },
  { ticker: "HNR1.DE", expectedName: "Hannover Rück" },
  { ticker: "CON.DE", expectedName: "Continental" },
  { ticker: "ZAL.DE", expectedName: "Zalando" },
  { ticker: "DHER.DE", expectedName: "Delivery Hero" },
  { ticker: "PAH3.DE", expectedName: "Porsche Automobil" },
  { ticker: "P911.DE", expectedName: "Porsche AG" },
  { ticker: "RHM.DE", expectedName: "Rheinmetall" },
  { ticker: "ENR.DE", expectedName: "Siemens Energy" },
  { ticker: "1COV.DE", expectedName: "Covestro" },
  { ticker: "DB1.DE", expectedName: "Deutsche Börse" },
  { ticker: "SHL.DE", expectedName: "Siemens Healthineers" },
  { ticker: "VNA.DE", expectedName: "Vonovia" },
  { ticker: "MRK.DE", expectedName: "Merck KGaA" },
  { ticker: "LEG.DE", expectedName: "LEG Immobilien" },

  // ─── Netherlands — Euronext Amsterdam (15) ───
  { ticker: "ASML.AS", expectedName: "ASML" },
  { ticker: "PRX.AS", expectedName: "Prosus" },
  { ticker: "ADYEN.AS", expectedName: "Adyen" },
  { ticker: "INGA.AS", expectedName: "ING Groep" },
  { ticker: "WKL.AS", expectedName: "Wolters Kluwer" },
  { ticker: "HEIA.AS", expectedName: "Heineken" },
  { ticker: "PHIA.AS", expectedName: "Philips" },
  { ticker: "RAND.AS", expectedName: "Randstad" },
  { ticker: "UNA.AS", expectedName: "Unilever" },
  { ticker: "AKZA.AS", expectedName: "Akzo Nobel" },
  { ticker: "AGN.AS", expectedName: "Aegon" },
  { ticker: "ASM.AS", expectedName: "ASM International" },
  { ticker: "BESI.AS", expectedName: "BE Semiconductor" },
  { ticker: "NN.AS", expectedName: "NN Group" },
  { ticker: "KPN.AS", expectedName: "KPN" },

  // ─── Belgium — Euronext Brussels (8) ───
  { ticker: "ABI.BR", expectedName: "AB InBev" },
  { ticker: "KBC.BR", expectedName: "KBC Group" },
  { ticker: "SOLB.BR", expectedName: "Solvay" },
  { ticker: "UCB.BR", expectedName: "UCB" },
  { ticker: "SOFIN.BR", expectedName: "Sofina" },
  { ticker: "GBLB.BR", expectedName: "GBL" },
  { ticker: "UMI.BR", expectedName: "Umicore" },
  { ticker: "ARGX.BR", expectedName: "argenx" },

  // ─── Spain — BME Madrid (15) ───
  { ticker: "SAN.MC", expectedName: "Banco Santander" },
  { ticker: "BBVA.MC", expectedName: "BBVA" },
  { ticker: "ITX.MC", expectedName: "Inditex" },
  { ticker: "IBE.MC", expectedName: "Iberdrola" },
  { ticker: "TEF.MC", expectedName: "Telefónica" },
  { ticker: "REP.MC", expectedName: "Repsol" },
  { ticker: "AMS.MC", expectedName: "Amadeus IT" },
  { ticker: "FER.MC", expectedName: "Ferrovial" },
  { ticker: "CABK.MC", expectedName: "CaixaBank" },
  { ticker: "ENG.MC", expectedName: "Enagás" },
  { ticker: "RED.MC", expectedName: "Red Eléctrica" },
  { ticker: "ACS.MC", expectedName: "ACS" },
  { ticker: "CLNX.MC", expectedName: "Cellnex" },
  { ticker: "GRF.MC", expectedName: "Grifols" },
  { ticker: "MAP.MC", expectedName: "Mapfre" },

  // ─── Italy — Borsa Italiana (15) ───
  { ticker: "ENI.MI", expectedName: "Eni" },
  { ticker: "ISP.MI", expectedName: "Intesa Sanpaolo" },
  { ticker: "ENEL.MI", expectedName: "Enel" },
  { ticker: "UCG.MI", expectedName: "UniCredit" },
  { ticker: "STMMI.MI", expectedName: "STMicro (Milan)" },
  { ticker: "G.MI", expectedName: "Generali" },
  { ticker: "RACE.MI", expectedName: "Ferrari" },
  { ticker: "LDO.MI", expectedName: "Leonardo" },
  { ticker: "TIT.MI", expectedName: "Telecom Italia" },
  { ticker: "BAMI.MI", expectedName: "Banco BPM" },
  { ticker: "CPR.MI", expectedName: "Campari" },
  { ticker: "TEN.MI", expectedName: "Tenaris" },
  { ticker: "SRG.MI", expectedName: "Snam" },
  { ticker: "PRY.MI", expectedName: "Prysmian" },
  { ticker: "PST.MI", expectedName: "Poste Italiane" },

  // ─── Portugal — Euronext Lisbon (4) ───
  { ticker: "EDP.LS", expectedName: "EDP" },
  { ticker: "GALP.LS", expectedName: "Galp Energia" },
  { ticker: "JMT.LS", expectedName: "Jerónimo Martins" },
  { ticker: "SON.LS", expectedName: "Sonae" },

  // ─── Finland — Helsinki (10) ───
  { ticker: "NOKIA.HE", expectedName: "Nokia" },
  { ticker: "SAMPO.HE", expectedName: "Sampo" },
  { ticker: "NRE1V.HE", expectedName: "Nordea" },
  { ticker: "FORTUM.HE", expectedName: "Fortum" },
  { ticker: "UPM.HE", expectedName: "UPM-Kymmene" },
  { ticker: "STERV.HE", expectedName: "Stora Enso" },
  { ticker: "NESTE.HE", expectedName: "Neste" },
  { ticker: "WRT1V.HE", expectedName: "Wärtsilä" },
  { ticker: "KNEBV.HE", expectedName: "Kone" },
  { ticker: "ELISA.HE", expectedName: "Elisa" },

  // ─── Ireland — Dublin / LSE (5) ───
  { ticker: "CRH.L", expectedName: "CRH" },
  { ticker: "RYA.L", expectedName: "Ryanair" },
  { ticker: "SKG.L", expectedName: "Smurfit Kappa" },
  { ticker: "KYGA.L", expectedName: "Kerry Group" },
  { ticker: "BIRG.L", expectedName: "Bank of Ireland" },

  // ─── Austria — Vienna (5) ───
  { ticker: "VOE.VI", expectedName: "Voestalpine" },
  { ticker: "OMV.VI", expectedName: "OMV" },
  { ticker: "EBS.VI", expectedName: "Erste Group" },
  { ticker: "VER.VI", expectedName: "Verbund" },
  { ticker: "WIE.VI", expectedName: "Wienerberger" },
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

      rsi14: null,
      sma50: null,
      sma200: null,
      priceVsSma50: null,
      priceVsSma200: null,
      perf1M: null,
      perf3M: null,
      perf6M: null,
      perf1Y: null,

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
    process.stdout.write(`  ${ticker.padEnd(12)} ${expectedName.padEnd(22)} ... `)
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

  console.log(`\nFetching price history (1 year) + computing technicals...\n`)
  await mkdir(PRICES_DIR, { recursive: true })
  let priceSuccesses = 0
  for (const stock of results) {
    process.stdout.write(`  ${stock.ticker.padEnd(12)} prices ... `)
    const history = await fetchPriceHistory(stock.ticker, stock.currency)
    if (history && history.candles.length > 0) {
      const filePath = path.join(PRICES_DIR, `${stock.ticker}.json`)
      await writeFile(filePath, JSON.stringify(history), "utf-8")
      enrichWithTechnicals(stock, history.candles)
      const rsi = stock.rsi14 != null ? `RSI=${stock.rsi14}` : ""
      console.log(`✓ ${history.candles.length} candles ${rsi}`)
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
