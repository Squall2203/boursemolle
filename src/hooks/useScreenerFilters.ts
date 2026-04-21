import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  DEFAULT_FILTERS,
  FILTER_BOUNDS,
  type ScreenerFilters,
} from "@/types/filters"

function parseRange(
  params: URLSearchParams,
  key: string,
  bounds: { min: number; max: number },
) {
  const minStr = params.get(`${key}Min`)
  const maxStr = params.get(`${key}Max`)
  const min = minStr != null ? Number(minStr) : bounds.min
  const max = maxStr != null ? Number(maxStr) : bounds.max
  return {
    min: Number.isFinite(min) ? min : bounds.min,
    max: Number.isFinite(max) ? max : bounds.max,
  }
}

function parseNum(params: URLSearchParams, key: string, defaultVal: number): number {
  const v = params.get(key)
  if (v == null) return defaultVal
  const n = Number(v)
  return Number.isFinite(n) ? n : defaultVal
}

function applyNum(params: URLSearchParams, key: string, value: number, defaultVal: number) {
  if (value !== defaultVal) params.set(key, String(value))
  else params.delete(key)
}

function parseList(params: URLSearchParams, key: string): string[] {
  const v = params.get(key)
  if (!v) return []
  return v.split(",").filter(Boolean)
}

function applyRange(
  params: URLSearchParams,
  key: string,
  range: { min: number; max: number },
  bounds: { min: number; max: number },
) {
  if (range.min > bounds.min) params.set(`${key}Min`, String(range.min))
  else params.delete(`${key}Min`)
  if (range.max < bounds.max) params.set(`${key}Max`, String(range.max))
  else params.delete(`${key}Max`)
}

function applyList(params: URLSearchParams, key: string, values: string[]) {
  if (values.length === 0) params.delete(key)
  else params.set(key, values.join(","))
}

interface UseScreenerFiltersResult {
  filters: ScreenerFilters
  setFilters: (next: Partial<ScreenerFilters>) => void
  resetFilters: () => void
}

export function useScreenerFilters(): UseScreenerFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<ScreenerFilters>(
    () => ({
      marketCap: parseRange(searchParams, "marketCap", FILTER_BOUNDS.marketCap),
      pe: parseRange(searchParams, "pe", FILTER_BOUNDS.pe),
      roe: parseRange(searchParams, "roe", FILTER_BOUNDS.roe),
      divYield: parseRange(searchParams, "divYield", FILTER_BOUNDS.divYield),
      rsi: parseRange(searchParams, "rsi", FILTER_BOUNDS.rsi),
      perf1M: parseRange(searchParams, "perf1M", FILTER_BOUNDS.perf1M),
      perf6M: parseRange(searchParams, "perf6M", FILTER_BOUNDS.perf6M),
      perf1Y: parseRange(searchParams, "perf1Y", FILTER_BOUNDS.perf1Y),
      scoreGlobal: parseRange(searchParams, "scoreGlobal", FILTER_BOUNDS.scoreGlobal),
      scoreValorisation: parseRange(searchParams, "scoreValorisation", FILTER_BOUNDS.scoreValorisation),
      scoreQualite: parseRange(searchParams, "scoreQualite", FILTER_BOUNDS.scoreQualite),
      scoreCroissance: parseRange(searchParams, "scoreCroissance", FILTER_BOUNDS.scoreCroissance),
      scoreSante: parseRange(searchParams, "scoreSante", FILTER_BOUNDS.scoreSante),
      scoreDividende: parseRange(searchParams, "scoreDividende", FILTER_BOUNDS.scoreDividende),
      scoreMomentum: parseRange(searchParams, "scoreMomentum", FILTER_BOUNDS.scoreMomentum),
      scoreQuant: parseRange(searchParams, "scoreQuant", FILTER_BOUNDS.scoreQuant),
      freshnessMaxDays: parseNum(searchParams, "freshnessMaxDays", 0),
      indices: parseList(searchParams, "indices"),
      sectors: parseList(searchParams, "sectors"),
      countries: parseList(searchParams, "countries"),
      signaux: parseList(searchParams, "signaux"),
    }),
    [searchParams],
  )

  const setFilters = useCallback(
    (next: Partial<ScreenerFilters>) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          const merged = { ...filters, ...next }
          applyRange(params, "marketCap", merged.marketCap, FILTER_BOUNDS.marketCap)
          applyRange(params, "pe", merged.pe, FILTER_BOUNDS.pe)
          applyRange(params, "roe", merged.roe, FILTER_BOUNDS.roe)
          applyRange(params, "divYield", merged.divYield, FILTER_BOUNDS.divYield)
          applyRange(params, "rsi", merged.rsi, FILTER_BOUNDS.rsi)
          applyRange(params, "perf1M", merged.perf1M, FILTER_BOUNDS.perf1M)
          applyRange(params, "perf6M", merged.perf6M, FILTER_BOUNDS.perf6M)
          applyRange(params, "perf1Y", merged.perf1Y, FILTER_BOUNDS.perf1Y)
          applyRange(params, "scoreGlobal", merged.scoreGlobal, FILTER_BOUNDS.scoreGlobal)
          applyRange(params, "scoreValorisation", merged.scoreValorisation, FILTER_BOUNDS.scoreValorisation)
          applyRange(params, "scoreQualite", merged.scoreQualite, FILTER_BOUNDS.scoreQualite)
          applyRange(params, "scoreCroissance", merged.scoreCroissance, FILTER_BOUNDS.scoreCroissance)
          applyRange(params, "scoreSante", merged.scoreSante, FILTER_BOUNDS.scoreSante)
          applyRange(params, "scoreDividende", merged.scoreDividende, FILTER_BOUNDS.scoreDividende)
          applyRange(params, "scoreMomentum", merged.scoreMomentum, FILTER_BOUNDS.scoreMomentum)
          applyRange(params, "scoreQuant", merged.scoreQuant, FILTER_BOUNDS.scoreQuant)
          applyNum(params, "freshnessMaxDays", merged.freshnessMaxDays, 0)
          applyList(params, "indices", merged.indices)
          applyList(params, "sectors", merged.sectors)
          applyList(params, "countries", merged.countries)
          applyList(params, "signaux", merged.signaux)
          return params
        },
        { replace: true },
      )
    },
    [filters, setSearchParams],
  )

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return { filters, setFilters, resetFilters }
}

export { DEFAULT_FILTERS }
