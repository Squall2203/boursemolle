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

  peaEligible: boolean
  fetchedAt: string
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
