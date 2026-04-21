import type { Stock } from "@/types/stock"

export type MarketFilter = "" | "pea" | "us" | "asia"
export type StockRegion = "eu" | "us" | "asia"

const US_EXCHANGES = new Set(["NYSE", "NasdaqGS", "NasdaqGM", "NYSEArca", "NASDAQ"])
const ASIA_EXCHANGES = new Set(["Tokyo", "HKSE", "YHD"])
const ASIA_COUNTRIES = new Set(["Japan", "China", "Hong Kong"])
const US_COUNTRIES = new Set(["United States"])

export function getStockRegion(stock: Stock): StockRegion {
  if (US_EXCHANGES.has(stock.exchange) || US_COUNTRIES.has(stock.country)) return "us"
  if (ASIA_EXCHANGES.has(stock.exchange) || ASIA_COUNTRIES.has(stock.country)) return "asia"
  return "eu"
}

export function matchesMarketFilter(stock: Stock, market: MarketFilter): boolean {
  if (!market) return true
  if (market === "pea") return stock.peaEligible === true
  if (market === "us") return getStockRegion(stock) === "us"
  if (market === "asia") return getStockRegion(stock) === "asia"
  return true
}
