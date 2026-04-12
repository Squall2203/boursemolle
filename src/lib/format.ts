const EM_DASH = "—"

export function formatMarketCap(n: number | null): string {
  if (n == null) return EM_DASH
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Md€`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} M€`
  return `${n.toFixed(0)} €`
}

export function formatPrice(n: number | null, currency = "EUR"): string {
  if (n == null) return EM_DASH
  const symbol = currency === "EUR" ? "€" : currency
  return `${n.toFixed(2)} ${symbol}`
}

export function formatPercent(n: number | null, withSign = false): string {
  if (n == null) return EM_DASH
  const sign = withSign && n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}%`
}

export function formatRatio(n: number | null): string {
  if (n == null) return EM_DASH
  return n.toFixed(2)
}
