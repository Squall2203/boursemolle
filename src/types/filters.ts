export interface RangeFilter {
  min: number
  max: number
}

export interface ScreenerFilters {
  marketCap: RangeFilter   // in billions of EUR (0..500)
  pe: RangeFilter          // 0..100
  roe: RangeFilter         // -50..100 (%)
  divYield: RangeFilter    // 0..15 (%)
  sectors: string[]        // empty = no filter
  countries: string[]      // empty = no filter
}

export const FILTER_BOUNDS = {
  marketCap: { min: 0, max: 500, step: 1 },
  pe: { min: 0, max: 100, step: 1 },
  roe: { min: -50, max: 100, step: 1 },
  divYield: { min: 0, max: 15, step: 0.5 },
} as const

export const DEFAULT_FILTERS: ScreenerFilters = {
  marketCap: { min: FILTER_BOUNDS.marketCap.min, max: FILTER_BOUNDS.marketCap.max },
  pe: { min: FILTER_BOUNDS.pe.min, max: FILTER_BOUNDS.pe.max },
  roe: { min: FILTER_BOUNDS.roe.min, max: FILTER_BOUNDS.roe.max },
  divYield: { min: FILTER_BOUNDS.divYield.min, max: FILTER_BOUNDS.divYield.max },
  sectors: [],
  countries: [],
}

export function isRangeActive(
  range: RangeFilter,
  bounds: { min: number; max: number },
): boolean {
  return range.min > bounds.min || range.max < bounds.max
}
