import type { PriceCandle } from "@/types/stock"

export type Signal = "Haussier" | "Neutre" | "Baissier"

export interface SMAData {
  sma20: number | null
  sma50: number | null
  sma200: number | null
  priceVsSma20: number | null
  priceVsSma50: number | null
  priceVsSma200: number | null
}

export interface RSIData {
  value: number
  interpretation: string
}

export interface SupportResistance {
  supports: number[]
  resistances: number[]
}

export interface CrossoverEvent {
  type: "golden" | "death"
  date: string
  daysAgo: number
}

export interface VolumeAnalysis {
  avgVolume20: number
  latestVolume: number
  trend: "Au-dessus de la moyenne" | "En dessous de la moyenne" | "Normal"
  ratio: number
}

export interface TechnicalAnalysis {
  signal: Signal
  signalColor: string
  confidence: number
  sma: SMAData
  rsi: RSIData
  supportResistance: SupportResistance
  crossovers: CrossoverEvent[]
  volume: VolumeAnalysis
  details: string[]
}

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null

  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }

  const avgGain = gains / period
  const avgLoss = losses / period

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function computeSMAArray(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      const slice = closes.slice(i - period + 1, i + 1)
      result.push(slice.reduce((a, b) => a + b, 0) / period)
    }
  }
  return result
}

function findCrossovers(
  sma50Array: (number | null)[],
  sma200Array: (number | null)[],
  dates: string[],
): CrossoverEvent[] {
  const events: CrossoverEvent[] = []
  const lastDate = dates[dates.length - 1]
  const lastTime = new Date(lastDate).getTime()

  for (let i = 1; i < sma50Array.length; i++) {
    const prev50 = sma50Array[i - 1]
    const curr50 = sma50Array[i]
    const prev200 = sma200Array[i - 1]
    const curr200 = sma200Array[i]

    if (prev50 == null || curr50 == null || prev200 == null || curr200 == null) continue

    if (prev50 <= prev200 && curr50 > curr200) {
      const daysAgo = Math.round(
        (lastTime - new Date(dates[i]).getTime()) / (1000 * 60 * 60 * 24),
      )
      events.push({ type: "golden", date: dates[i], daysAgo })
    } else if (prev50 >= prev200 && curr50 < curr200) {
      const daysAgo = Math.round(
        (lastTime - new Date(dates[i]).getTime()) / (1000 * 60 * 60 * 24),
      )
      events.push({ type: "death", date: dates[i], daysAgo })
    }
  }

  return events.slice(-3)
}

function findSupportsResistances(candles: PriceCandle[]): SupportResistance {
  const recent = candles.slice(-60)
  if (recent.length < 10) return { supports: [], resistances: [] }

  const currentPrice = recent[recent.length - 1].close
  const pivots: Array<{ price: number; type: "high" | "low" }> = []

  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i]
    const isHigh =
      c.high > recent[i - 1].high &&
      c.high > recent[i - 2].high &&
      c.high > recent[i + 1].high &&
      c.high > recent[i + 2].high
    const isLow =
      c.low < recent[i - 1].low &&
      c.low < recent[i - 2].low &&
      c.low < recent[i + 1].low &&
      c.low < recent[i + 2].low

    if (isHigh) pivots.push({ price: Math.round(c.high * 100) / 100, type: "high" })
    if (isLow) pivots.push({ price: Math.round(c.low * 100) / 100, type: "low" })
  }

  const supports = pivots
    .filter((p) => p.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map((p) => p.price)

  const resistances = pivots
    .filter((p) => p.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((p) => p.price)

  return { supports, resistances }
}

function analyzeVolume(candles: PriceCandle[]): VolumeAnalysis {
  const volumes = candles.map((c) => c.volume)
  const last20 = volumes.slice(-20)
  const avgVolume20 = last20.reduce((a, b) => a + b, 0) / last20.length
  const latestVolume = volumes[volumes.length - 1]
  const ratio = Math.round((latestVolume / avgVolume20) * 100) / 100

  let trend: VolumeAnalysis["trend"] = "Normal"
  if (ratio > 1.5) trend = "Au-dessus de la moyenne"
  else if (ratio < 0.6) trend = "En dessous de la moyenne"

  return { avgVolume20: Math.round(avgVolume20), latestVolume, trend, ratio }
}

export function analyzeTechnicals(candles: PriceCandle[]): TechnicalAnalysis | null {
  if (candles.length < 50) return null

  const closes = candles.map((c) => c.close)
  const dates = candles.map((c) => c.date)
  const currentPrice = closes[closes.length - 1]

  const sma20 = computeSMA(closes, 20)
  const sma50 = computeSMA(closes, 50)
  const sma200 = computeSMA(closes, 200)

  const pctVs = (sma: number | null) =>
    sma != null ? Math.round(((currentPrice - sma) / sma) * 10000) / 100 : null

  const sma: SMAData = {
    sma20,
    sma50,
    sma200,
    priceVsSma20: pctVs(sma20),
    priceVsSma50: pctVs(sma50),
    priceVsSma200: pctVs(sma200),
  }

  const rsiValue = computeRSI(closes)
  const rsi: RSIData = {
    value: rsiValue != null ? Math.round(rsiValue * 10) / 10 : 50,
    interpretation:
      rsiValue == null
        ? "Indéterminé"
        : rsiValue > 70
          ? "Suracheté — pression vendeuse probable"
          : rsiValue < 30
            ? "Survendu — rebond possible"
            : rsiValue > 60
              ? "Zone haussière"
              : rsiValue < 40
                ? "Zone baissière"
                : "Neutre",
  }

  const sma50Array = computeSMAArray(closes, 50)
  const sma200Array = computeSMAArray(closes, 200)
  const crossovers = findCrossovers(sma50Array, sma200Array, dates)

  const supportResistance = findSupportsResistances(candles)
  const volume = analyzeVolume(candles)

  const details: string[] = []
  let bullPoints = 0
  let bearPoints = 0

  if (sma.priceVsSma20 != null) {
    if (sma.priceVsSma20 > 0) {
      bullPoints++
      details.push(`Prix au-dessus de la SMA 20 (${sma.priceVsSma20 > 0 ? "+" : ""}${sma.priceVsSma20.toFixed(1)}%)`)
    } else {
      bearPoints++
      details.push(`Prix en dessous de la SMA 20 (${sma.priceVsSma20.toFixed(1)}%)`)
    }
  }

  if (sma.priceVsSma50 != null) {
    if (sma.priceVsSma50 > 0) {
      bullPoints++
      details.push(`Prix au-dessus de la SMA 50 (${sma.priceVsSma50 > 0 ? "+" : ""}${sma.priceVsSma50.toFixed(1)}%)`)
    } else {
      bearPoints++
      details.push(`Prix en dessous de la SMA 50 (${sma.priceVsSma50.toFixed(1)}%)`)
    }
  }

  if (sma.priceVsSma200 != null) {
    if (sma.priceVsSma200 > 0) {
      bullPoints++
      details.push(`Prix au-dessus de la SMA 200 (${sma.priceVsSma200 > 0 ? "+" : ""}${sma.priceVsSma200.toFixed(1)}%) — tendance long terme haussière`)
    } else {
      bearPoints++
      details.push(`Prix en dessous de la SMA 200 (${sma.priceVsSma200.toFixed(1)}%) — tendance long terme baissière`)
    }
  }

  if (rsiValue != null) {
    if (rsiValue > 70) {
      bearPoints++
      details.push(`RSI à ${rsi.value} — zone de surachat`)
    } else if (rsiValue < 30) {
      bullPoints++
      details.push(`RSI à ${rsi.value} — zone de survente, rebond possible`)
    } else if (rsiValue > 55) {
      bullPoints += 0.5
      details.push(`RSI à ${rsi.value} — momentum haussier modéré`)
    } else if (rsiValue < 45) {
      bearPoints += 0.5
      details.push(`RSI à ${rsi.value} — momentum baissier modéré`)
    }
  }

  for (const cross of crossovers) {
    if (cross.daysAgo <= 30) {
      if (cross.type === "golden") {
        bullPoints += 2
        details.push(`Golden Cross récent (il y a ${cross.daysAgo} jours) — signal haussier fort`)
      } else {
        bearPoints += 2
        details.push(`Death Cross récent (il y a ${cross.daysAgo} jours) — signal baissier fort`)
      }
    }
  }

  if (volume.ratio > 1.5) {
    details.push(`Volume élevé (${volume.ratio}x la moyenne) — conviction du mouvement`)
  }

  let signal: Signal
  let confidence: number
  const diff = bullPoints - bearPoints
  if (diff >= 2) {
    signal = "Haussier"
    confidence = Math.min(90, 50 + diff * 10)
  } else if (diff <= -2) {
    signal = "Baissier"
    confidence = Math.min(90, 50 + Math.abs(diff) * 10)
  } else {
    signal = "Neutre"
    confidence = 50
  }

  const signalColor =
    signal === "Haussier"
      ? "text-emerald-600 dark:text-emerald-400"
      : signal === "Baissier"
        ? "text-red-600 dark:text-red-400"
        : "text-yellow-600 dark:text-yellow-400"

  return {
    signal,
    signalColor,
    confidence,
    sma,
    rsi,
    supportResistance,
    crossovers,
    volume,
    details,
  }
}
