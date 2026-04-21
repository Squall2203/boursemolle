export interface RangeFilter {
  min: number
  max: number
}

export interface ScreenerFilters {
  marketCap: RangeFilter   // in billions of EUR (0..500)
  pe: RangeFilter          // 0..100
  roe: RangeFilter         // -50..100 (%)
  divYield: RangeFilter    // 0..15 (%)
  rsi: RangeFilter         // 0..100
  perf1M: RangeFilter      // -80..200 (%)
  perf6M: RangeFilter      // -80..200 (%)
  perf1Y: RangeFilter      // -80..500 (%)
  scoreGlobal: RangeFilter      // 0..10
  scoreValorisation: RangeFilter
  scoreQualite: RangeFilter
  scoreCroissance: RangeFilter
  scoreSante: RangeFilter
  scoreDividende: RangeFilter
  scoreMomentum: RangeFilter
  scoreQuant: RangeFilter
  freshnessMaxDays: number  // 0 = no filter, 3/7/14 = max days since lastFundamentalsUpdate
  indices: string[]        // empty = no filter
  sectors: string[]        // empty = no filter
  countries: string[]      // empty = no filter
  signaux: string[]        // empty = no filter (FlagId values)
}

export const FILTER_BOUNDS = {
  marketCap: { min: 0, max: 500, step: 1 },
  pe: { min: 0, max: 100, step: 1 },
  roe: { min: -50, max: 100, step: 1 },
  divYield: { min: 0, max: 15, step: 0.5 },
  rsi: { min: 0, max: 100, step: 1 },
  perf1M: { min: -80, max: 200, step: 1 },
  perf6M: { min: -80, max: 200, step: 1 },
  perf1Y: { min: -80, max: 500, step: 5 },
  scoreGlobal: { min: 0, max: 10, step: 0.5 },
  scoreValorisation: { min: 0, max: 10, step: 0.5 },
  scoreQualite: { min: 0, max: 10, step: 0.5 },
  scoreCroissance: { min: 0, max: 10, step: 0.5 },
  scoreSante: { min: 0, max: 10, step: 0.5 },
  scoreDividende: { min: 0, max: 10, step: 0.5 },
  scoreMomentum: { min: 0, max: 10, step: 0.5 },
  scoreQuant: { min: 0, max: 10, step: 0.5 },
} as const

export const DEFAULT_FILTERS: ScreenerFilters = {
  marketCap: { min: FILTER_BOUNDS.marketCap.min, max: FILTER_BOUNDS.marketCap.max },
  pe: { min: FILTER_BOUNDS.pe.min, max: FILTER_BOUNDS.pe.max },
  roe: { min: FILTER_BOUNDS.roe.min, max: FILTER_BOUNDS.roe.max },
  divYield: { min: FILTER_BOUNDS.divYield.min, max: FILTER_BOUNDS.divYield.max },
  rsi: { min: FILTER_BOUNDS.rsi.min, max: FILTER_BOUNDS.rsi.max },
  perf1M: { min: FILTER_BOUNDS.perf1M.min, max: FILTER_BOUNDS.perf1M.max },
  perf6M: { min: FILTER_BOUNDS.perf6M.min, max: FILTER_BOUNDS.perf6M.max },
  perf1Y: { min: FILTER_BOUNDS.perf1Y.min, max: FILTER_BOUNDS.perf1Y.max },
  scoreGlobal: { min: 0, max: 10 },
  scoreValorisation: { min: 0, max: 10 },
  scoreQualite: { min: 0, max: 10 },
  scoreCroissance: { min: 0, max: 10 },
  scoreSante: { min: 0, max: 10 },
  scoreDividende: { min: 0, max: 10 },
  scoreMomentum: { min: 0, max: 10 },
  scoreQuant: { min: 0, max: 10 },
  freshnessMaxDays: 0,
  indices: [],
  sectors: [],
  countries: [],
  signaux: [],
}

export function isRangeActive(
  range: RangeFilter,
  bounds: { min: number; max: number },
): boolean {
  return range.min > bounds.min || range.max < bounds.max
}
