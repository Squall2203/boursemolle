export interface Stock {
  ticker: string
  name: string
  exchange: string
  currency: string
  country: string
  sector: string | null
  industry: string | null

  price: number | null
  priceChange: number | null
  priceChangePercent: number | null

  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  enterpriseValue: number | null
  evToEbitda: number | null

  returnOnEquity: number | null
  returnOnAssets: number | null
  profitMargins: number | null
  operatingMargins: number | null

  revenueGrowth: number | null
  earningsGrowth: number | null

  totalDebt: number | null
  totalCash: number | null
  debtToEquity: number | null

  dividendYield: number | null
  payoutRatio: number | null

  description: string | null
  employees: number | null
  website: string | null

  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null

  // Technical indicators (computed from price history at ingestion)
  rsi14: number | null
  sma50: number | null
  sma200: number | null
  priceVsSma50: number | null   // % above/below SMA50
  priceVsSma200: number | null  // % above/below SMA200
  perf1M: number | null         // % performance 1 month
  perf3M: number | null
  perf6M: number | null
  perf1Y: number | null

  indices: string[]

  annualFinancials: AnnualFinancial[]
  dividendHistory: AnnualDividend[]

  peaEligible: boolean
  fetchedAt: string
  lastFundamentalsUpdate?: string | null
  refreshPriority?: number | null   // 0=critique, 1=haute, 2=normale, 3=basse
}

export interface AnnualFinancial {
  year: number
  revenue: number | null
  netIncome: number | null
}

export interface AnnualDividend {
  year: number
  total: number
}

export interface PriceCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockPriceHistory {
  ticker: string
  currency: string
  candles: PriceCandle[]
}

export interface StocksDataset {
  generatedAt: string
  count: number
  stocks: Stock[]
}
