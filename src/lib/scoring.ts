import type { Stock } from "@/types/stock"

export type ScoreLabel = "Achat fort" | "Achat" | "Neutre" | "Prudence" | "Vente"

export interface StockScore {
  total: number // 0-10
  label: ScoreLabel
  labelColor: string
  pillars: {
    valuation: number // 0-10
    quality: number
    growth: number
    dividend: number
  }
  summary: string
}

function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v))
}

function percentileScore(
  value: number | null,
  values: number[],
  invert = false,
): number {
  if (value == null || values.length === 0) return 5
  const sorted = [...values].sort((a, b) => a - b)
  let rank = 0
  for (const v of sorted) {
    if (v <= value) rank++
  }
  const pct = rank / sorted.length
  return clamp((invert ? 1 - pct : pct) * 10)
}

function computeValuation(stock: Stock, universe: Stock[]): number {
  const peValues = universe.map((s) => s.trailingPE).filter((v) => v != null)
  const evValues = universe.map((s) => s.evToEbitda).filter((v) => v != null)
  const pbValues = universe.map((s) => s.priceToBook).filter((v) => v != null)

  const peScore = percentileScore(stock.trailingPE, peValues, true)
  const evScore = percentileScore(stock.evToEbitda, evValues, true)
  const pbScore = percentileScore(stock.priceToBook, pbValues, true)

  let count = 0
  let sum = 0
  if (stock.trailingPE != null) { sum += peScore; count++ }
  if (stock.evToEbitda != null) { sum += evScore; count++ }
  if (stock.priceToBook != null) { sum += pbScore; count++ }

  return count > 0 ? sum / count : 5
}

function computeQuality(stock: Stock, universe: Stock[]): number {
  const roeValues = universe.map((s) => s.returnOnEquity).filter((v) => v != null)
  const marginValues = universe.map((s) => s.profitMargins).filter((v) => v != null)
  const deValues = universe.map((s) => s.debtToEquity).filter((v) => v != null)

  const roeScore = percentileScore(stock.returnOnEquity, roeValues)
  const marginScore = percentileScore(stock.profitMargins, marginValues)
  const deScore = percentileScore(stock.debtToEquity, deValues, true)

  let count = 0
  let sum = 0
  if (stock.returnOnEquity != null) { sum += roeScore; count++ }
  if (stock.profitMargins != null) { sum += marginScore; count++ }
  if (stock.debtToEquity != null) { sum += deScore; count++ }

  return count > 0 ? sum / count : 5
}

function computeGrowth(stock: Stock, universe: Stock[]): number {
  const revValues = universe.map((s) => s.revenueGrowth).filter((v) => v != null)
  const epsValues = universe.map((s) => s.earningsGrowth).filter((v) => v != null)

  const revScore = percentileScore(stock.revenueGrowth, revValues)
  const epsScore = percentileScore(stock.earningsGrowth, epsValues)

  let count = 0
  let sum = 0
  if (stock.revenueGrowth != null) { sum += revScore; count++ }
  if (stock.earningsGrowth != null) { sum += epsScore; count++ }

  return count > 0 ? sum / count : 5
}

function computeDividend(stock: Stock, universe: Stock[]): number {
  const yieldValues = universe.map((s) => s.dividendYield).filter((v) => v != null)
  const payoutValues = universe.map((s) => s.payoutRatio).filter((v) => v != null)

  const yieldScore = percentileScore(stock.dividendYield, yieldValues)
  const payoutScore = percentileScore(stock.payoutRatio, payoutValues, true)

  if (stock.dividendYield == null || stock.dividendYield === 0) return 3

  let count = 0
  let sum = 0
  if (stock.dividendYield != null) { sum += yieldScore; count++ }
  if (stock.payoutRatio != null) { sum += payoutScore; count++ }

  return count > 0 ? sum / count : 5
}

function getLabel(score: number): ScoreLabel {
  if (score >= 7.5) return "Achat fort"
  if (score >= 6) return "Achat"
  if (score >= 4) return "Neutre"
  if (score >= 2.5) return "Prudence"
  return "Vente"
}

function getLabelColor(label: ScoreLabel): string {
  switch (label) {
    case "Achat fort": return "text-emerald-600 dark:text-emerald-400"
    case "Achat": return "text-green-600 dark:text-green-400"
    case "Neutre": return "text-yellow-600 dark:text-yellow-400"
    case "Prudence": return "text-orange-600 dark:text-orange-400"
    case "Vente": return "text-red-600 dark:text-red-400"
  }
}

function buildSummary(pillars: StockScore["pillars"]): string {
  const parts: string[] = []

  if (pillars.valuation >= 7) parts.push("valorisation attractive")
  else if (pillars.valuation >= 5) parts.push("valorisation correcte")
  else if (pillars.valuation < 3) parts.push("valorisation élevée")

  if (pillars.quality >= 7) parts.push("profitabilité élevée")
  else if (pillars.quality < 3) parts.push("profitabilité faible")

  if (pillars.growth >= 7) parts.push("forte croissance")
  else if (pillars.growth < 3) parts.push("croissance faible")

  if (pillars.dividend >= 7) parts.push("dividende attractif")
  else if (pillars.dividend < 3) parts.push("dividende faible ou absent")

  if (parts.length === 0) return "Profil équilibré sans facteur dominant."

  return parts
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(", ") + "."
}

export function computeScore(stock: Stock, universe: Stock[]): StockScore {
  const valuation = computeValuation(stock, universe)
  const quality = computeQuality(stock, universe)
  const growth = computeGrowth(stock, universe)
  const dividend = computeDividend(stock, universe)

  const total = clamp(
    valuation * 0.3 + quality * 0.3 + growth * 0.2 + dividend * 0.2,
  )

  const pillars = { valuation, quality, growth, dividend }
  const label = getLabel(total)

  return {
    total: Math.round(total * 10) / 10,
    label,
    labelColor: getLabelColor(label),
    pillars,
    summary: buildSummary(pillars),
  }
}
