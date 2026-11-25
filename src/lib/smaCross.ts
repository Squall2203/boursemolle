export interface SmaCross {
  type: "golden" | "death"
  /** Nombre de séances écoulées depuis le croisement (0 = dernière séance) */
  daysAgo: number
}

function smaAt(closes: number[], endIndex: number, period: number): number | null {
  if (endIndex + 1 < period) return null
  let sum = 0
  for (let i = endIndex - period + 1; i <= endIndex; i++) sum += closes[i]
  return sum / period
}

/**
 * Cherche le dernier croisement réel de la moyenne 50 séances avec la moyenne 200 séances
 * dans les `lookback` dernières séances. Renvoie null s'il n'y en a pas eu.
 */
export function detectSmaCross(closes: number[], lookback = 30): SmaCross | null {
  const last = closes.length - 1
  for (let daysAgo = 0; daysAgo < lookback; daysAgo++) {
    const i = last - daysAgo
    const s50 = smaAt(closes, i, 50)
    const s200 = smaAt(closes, i, 200)
    const p50 = smaAt(closes, i - 1, 50)
    const p200 = smaAt(closes, i - 1, 200)
    if (s50 == null || s200 == null || p50 == null || p200 == null) return null
    if (p50 <= p200 && s50 > s200) return { type: "golden", daysAgo }
    if (p50 >= p200 && s50 < s200) return { type: "death", daysAgo }
  }
  return null
}
