import type { Stock } from "../types/stock"

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
  // Devises dans lesquelles certaines sociétés publient leurs comptes sans y être cotées
  CNY: 0.126, TWD: 0.028, KRW: 0.00066, SGD: 0.68, INR: 0.011, BRL: 0.16, MXN: 0.05, ZAR: 0.05, ILS: 0.25, PLN: 0.23, CZK: 0.04, HUF: 0.0025,
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

/**
 * Trésorerie dégagée sur un exercice, en % de la capitalisation boursière.
 * Les comptes peuvent être publiés dans une autre devise que celle de la cotation : tout est ramené en euros.
 */
export function freeCashflowYield(
  freeCashFlow: number | null | undefined, financialCurrency: string, marketCapInEur: number | null | undefined, rates?: FxRates | null,
): number | null {
  const fcfEur = toEur(freeCashFlow, financialCurrency, rates)
  if (fcfEur == null || marketCapInEur == null || !(marketCapInEur > 0)) return null
  return Math.round((fcfEur / marketCapInEur) * 10000) / 100
}

/** Capitalisation en euros : valeur fournie par l'ingestion, sinon conversion à la volée. */
export function marketCapEur(stock: Stock, rates?: FxRates | null): number | null {
  if (stock.marketCapEur != null) return stock.marketCapEur
  return toEur(stock.marketCap, stock.currency, rates)
}
