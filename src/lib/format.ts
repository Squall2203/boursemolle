const EM_DASH = "—"

export function formatMarketCap(n: number | null, currency = "EUR"): string {
  if (n == null) return EM_DASH
  // GBp stocks: market cap is in GBP (pounds), not pence — treat as GBP
  const c = currency === "GBp" ? "GBP" : currency
  const sym = c === "USD" ? "$" : c === "GBP" ? "£" : "€"
  const suffix = c === "USD" ? "B" : "Md"
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} ${suffix}${sym}`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} M${sym}`
  return `${n.toFixed(0)} ${sym}`
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", CHF: "CHF", SEK: "kr",
  DKK: "kr", NOK: "kr", JPY: "¥", HKD: "HK$", CAD: "CA$",
}
const PREFIX_CURRENCIES = new Set(["USD", "GBP", "CAD", "HKD", "JPY"])

export function formatPrice(n: number | null, currency = "EUR"): string {
  if (n == null) return EM_DASH
  // GBp = British pence (LSE quotes in pence, not pounds)
  if (currency === "GBp") return `${Math.round(n).toLocaleString("fr-FR")}p`
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  return PREFIX_CURRENCIES.has(currency)
    ? `${symbol}${n.toFixed(2)}`
    : `${n.toFixed(2)} ${symbol}`
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
