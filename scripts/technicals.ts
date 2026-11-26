/**
 * Indicateurs calculés à partir de l'historique de cours (tendance, RSI, performances).
 * Partagé entre l'ingestion quotidienne et la reconstitution des notes passées, pour que les deux
 * calculent exactement la même chose.
 */
import type { Stock, PriceCandle } from "../src/types/stock.ts"
import { detectSmaCross } from "../src/lib/smaCross.ts"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return round2(slice.reduce((a, b) => a + b, 0) / period)
}

export function computeRSI(closes: number[], period: number = 14): number | null {
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

export function computePerf(closes: number[], tradingDays: number): number | null {
  if (closes.length < tradingDays + 1) return null
  const current = closes[closes.length - 1]
  const past = closes[closes.length - 1 - tradingDays]
  return round2(((current - past) / past) * 100)
}

export function enrichWithTechnicals(stock: Stock, candles: PriceCandle[]): void {
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

