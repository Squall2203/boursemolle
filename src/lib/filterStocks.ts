import type { Stock } from "@/types/stock"
import {
  FILTER_BOUNDS,
  isRangeActive,
  type RangeFilter,
  type ScreenerFilters,
} from "@/types/filters"

function inRange(
  value: number | null,
  range: RangeFilter,
  bounds: { min: number; max: number },
): boolean {
  if (!isRangeActive(range, bounds)) return true
  if (value == null) return false
  return value >= range.min && value <= range.max
}

export function filterStocks(
  stocks: Stock[],
  filters: ScreenerFilters,
): Stock[] {
  return stocks.filter((s) => {
    const marketCapB = s.marketCap != null ? s.marketCap / 1e9 : null
    if (!inRange(marketCapB, filters.marketCap, FILTER_BOUNDS.marketCap)) return false
    if (!inRange(s.trailingPE, filters.pe, FILTER_BOUNDS.pe)) return false
    if (!inRange(s.returnOnEquity, filters.roe, FILTER_BOUNDS.roe)) return false
    if (!inRange(s.dividendYield, filters.divYield, FILTER_BOUNDS.divYield)) return false
    if (!inRange(s.rsi14, filters.rsi, FILTER_BOUNDS.rsi)) return false
    if (!inRange(s.perf1M, filters.perf1M, FILTER_BOUNDS.perf1M)) return false
    if (!inRange(s.perf6M, filters.perf6M, FILTER_BOUNDS.perf6M)) return false
    if (!inRange(s.perf1Y, filters.perf1Y, FILTER_BOUNDS.perf1Y)) return false

    if (filters.sectors.length > 0) {
      if (!s.sector || !filters.sectors.includes(s.sector)) return false
    }
    if (filters.countries.length > 0) {
      if (!filters.countries.includes(s.country)) return false
    }

    return true
  })
}
