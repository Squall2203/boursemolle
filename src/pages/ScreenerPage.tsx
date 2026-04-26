import { useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActiveFiltersBar } from "@/components/screener/ActiveFiltersBar"
import { FilterPanel } from "@/components/screener/FilterPanel"
import { MarketPills } from "@/components/screener/MarketPills"
import { PresetBar } from "@/components/screener/PresetBar"
import { ResultsTable } from "@/components/screener/ResultsTable"
import { SavedScreeners } from "@/components/screener/SavedScreeners"
import { ScoreQuickFilter } from "@/components/screener/ScoreQuickFilter"
import { useScreenerFilters } from "@/hooks/useScreenerFilters"
import { useStocks } from "@/hooks/useStocks"
import { useViewMode } from "@/hooks/useViewMode"
import { filterStocks } from "@/lib/filterStocks"
import { matchesMarketFilter, type MarketFilter } from "@/lib/market"
import { computeScore, type StockScore } from "@/lib/scoring"
import { FILTER_BOUNDS, isRangeActive } from "@/types/filters"

export function ScreenerPage() {
  const { data, loading, error, refresh } = useStocks()
  const { filters, setFilters, resetFilters } = useScreenerFilters()
  const { isSimple } = useViewMode()

  const allStocks = useMemo(() => data?.stocks ?? [], [data])

  // Market counts for pills
  const marketCounts = useMemo(() => {
    const markets: MarketFilter[] = ["", "pea", "us", "asia"]
    return Object.fromEntries(
      markets.map((m) => [m, allStocks.filter((s) => matchesMarketFilter(s, m)).length])
    ) as Record<MarketFilter, number>
  }, [allStocks])

  const availableSectors = useMemo(() => {
    const set = new Set<string>()
    for (const s of allStocks) if (s.sector) set.add(s.sector)
    return Array.from(set).sort()
  }, [allStocks])

  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    for (const s of allStocks) set.add(s.country)
    return Array.from(set).sort()
  }, [allStocks])

  // Step 1: attribute-based filter (no score needed)
  const attrFiltered = useMemo(
    () => filterStocks(allStocks, filters),
    [allStocks, filters],
  )

  // Step 2: compute scores once for all attribute-filtered stocks
  const scoreMap = useMemo(() => {
    const map = new Map<string, StockScore>()
    for (const s of attrFiltered) {
      map.set(s.ticker, computeScore(s, allStocks))
    }
    return map
  }, [attrFiltered, allStocks])

  // Step 3: apply score + signal filters
  const scoreActive = isRangeActive(filters.scoreGlobal, FILTER_BOUNDS.scoreGlobal)
    || isRangeActive(filters.scoreValorisation, FILTER_BOUNDS.scoreValorisation)
    || isRangeActive(filters.scoreQualite, FILTER_BOUNDS.scoreQualite)
    || isRangeActive(filters.scoreCroissance, FILTER_BOUNDS.scoreCroissance)
    || isRangeActive(filters.scoreSante, FILTER_BOUNDS.scoreSante)
    || isRangeActive(filters.scoreDividende, FILTER_BOUNDS.scoreDividende)
    || isRangeActive(filters.scoreMomentum, FILTER_BOUNDS.scoreMomentum)
    || isRangeActive(filters.scoreQuant, FILTER_BOUNDS.scoreQuant)

  const filteredStocks = useMemo(() => {
    const hasSignaux = filters.signaux.length > 0
    if (!scoreActive && !hasSignaux) return attrFiltered
    return attrFiltered.filter((s) => {
      const score = scoreMap.get(s.ticker)
      if (!score) return false
      if (scoreActive) {
        const p = score.pillars
        if (score.total < filters.scoreGlobal.min || score.total > filters.scoreGlobal.max) return false
        if (p.valorisation < filters.scoreValorisation.min || p.valorisation > filters.scoreValorisation.max) return false
        if (p.qualite < filters.scoreQualite.min || p.qualite > filters.scoreQualite.max) return false
        if (p.croissance < filters.scoreCroissance.min || p.croissance > filters.scoreCroissance.max) return false
        if (p.sante < filters.scoreSante.min || p.sante > filters.scoreSante.max) return false
        if (p.dividende < filters.scoreDividende.min || p.dividende > filters.scoreDividende.max) return false
        if (p.momentum < filters.scoreMomentum.min || p.momentum > filters.scoreMomentum.max) return false
        if (p.quant < filters.scoreQuant.min || p.quant > filters.scoreQuant.max) return false
      }
      if (hasSignaux) {
        if (!filters.signaux.some((sig) => score.flags.some((f) => f.id === sig))) return false
      }
      return true
    })
  }, [attrFiltered, scoreMap, scoreActive, filters.scoreGlobal, filters.scoreValorisation, filters.scoreQualite, filters.scoreCroissance, filters.scoreSante, filters.scoreDividende, filters.scoreMomentum, filters.scoreQuant, filters.signaux])

  // Step 4: badge counts for filter panel (from final filtered list)
  const badgeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of filteredStocks) {
      const score = scoreMap.get(s.ticker)
      if (!score) continue
      for (const f of score.flags) {
        counts.set(f.id, (counts.get(f.id) ?? 0) + 1)
      }
    }
    return counts
  }, [filteredStocks, scoreMap])

  return (
    <div className={isSimple ? "space-y-4" : "grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]"}>
      {!isSimple && (
        <aside>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={resetFilters}
            availableSectors={availableSectors}
            availableCountries={availableCountries}
            badgeCounts={badgeCounts}
          />
        </aside>
      )}
      <main className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
            <p className="text-sm text-muted-foreground">
              {allStocks.length} actions — Europe · États-Unis · Asie
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreQuickFilter value={filters.scoreGlobal.min} onChange={(min) => setFilters({ scoreGlobal: { min, max: 10 } })} />
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <div className="text-sm text-muted-foreground">
              {loading ? (
                "Chargement..."
              ) : error ? (
                <span className="text-destructive">Erreur : {error}</span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {filteredStocks.length}
                  </span>{" "}
                  / {allStocks.length} résultats
                </>
              )}
            </div>
          </div>
        </header>
        <MarketPills
          value={filters.market}
          onChange={(market) => setFilters({ market })}
          counts={marketCounts}
        />
        <div className="flex flex-wrap items-center gap-2">
          <PresetBar filters={filters} onApply={setFilters} onReset={resetFilters} />
          {!isSimple && <SavedScreeners filters={filters} onLoad={setFilters} />}
        </div>
        {!isSimple && <ActiveFiltersBar filters={filters} onChange={setFilters} onReset={resetFilters} />}
        {!loading && !error && <ResultsTable stocks={filteredStocks} scoreMap={scoreMap} />}
      </main>
    </div>
  )
}
