import type { Stock } from "@/types/stock"

/** Valeur en euros d'une unité de chaque devise (EUR = 1). */
export type FxRates = Record<string, number>

/**
 * Taux de secours, utilisés seulement si le jeu de données ne fournit pas `fxRates`
 * (fichier généré avant l'ajout des taux à l'ingestion). Ordres de grandeur, pas des cours du jour.
 */
export const FALLBACK_FX_RATES: FxRates = {
  EUR: 1,
  USD: 0.91,
  GBP: 1.19,
  CHF: 1.06,
  SEK: 0.089,
  DKK: 0.134,
  NOK: 0.086,
  JPY: 0.0058,
  HKD: 0.117,
  CAD: 0.66,
  AUD: 0.6,
}

/** Yahoo cote Londres en pence (GBp) mais exprime les capitalisations et les bilans en livres. */
export function normalizeCurrency(currency: string): string {
  return currency === "GBp" ? "GBP" : currency
}

export function toEur(amount: number | null | undefined, currency: string, rates?: FxRates | null): number | null {
  if (amount == null || Number.isNaN(amount)) return null
  const c = normalizeCurrency(currency)
  if (c === "EUR") return amount
  const rate = rates?.[c] ?? FALLBACK_FX_RATES[c]
  return rate != null ? amount * rate : null
}

/** Capitalisation en euros : valeur fournie par l'ingestion, sinon conversion à la volée. */
export function marketCapEur(stock: Stock, rates?: FxRates | null): number | null {
  if (stock.marketCapEur != null) return stock.marketCapEur
  return toEur(stock.marketCap, stock.currency, rates)
}
