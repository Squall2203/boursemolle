import { useMemo } from "react"
import { ActiveFiltersBar } from "@/components/screener/ActiveFiltersBar"
import { FilterPanel } from "@/components/screener/FilterPanel"
import { PresetBar } from "@/components/screener/PresetBar"
import { ResultsTable } from "@/components/screener/ResultsTable"
import { SavedScreeners } from "@/components/screener/SavedScreeners"
import { useScreenerFilters } from "@/hooks/useScreenerFilters"
import { useStocks } from "@/hooks/useStocks"
import { useViewMode } from "@/hooks/useViewMode"
import { filterStocks } from "@/lib/filterStocks"
import { computeScore } from "@/lib/scoring"

export function ScreenerPage() {
  const { data, loading, error } = useStocks()
  const { filters, setFilters, resetFilters } = useScreenerFilters()
  const { isSimple } = useViewMode()

  const allStocks = data?.stocks ?? []

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

  const filteredStocks = useMemo(
    () => filterStocks(allStocks, filters),
    [allStocks, filters],
  )

  const badgeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of filteredStocks) {
      const score = computeScore(s, allStocks)
      for (const f of score.flags) {
        counts.set(f.id, (counts.get(f.id) ?? 0) + 1)
      }
    }
    return counts
  }, [filteredStocks, allStocks])

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
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
            <p className="text-sm text-muted-foreground">
              Actions européennes — données Yahoo Finance
            </p>
          </div>
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
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <PresetBar filters={filters} onApply={setFilters} onReset={resetFilters} />
          {!isSimple && <SavedScreeners filters={filters} onLoad={setFilters} />}
        </div>
        {!isSimple && <ActiveFiltersBar filters={filters} onChange={setFilters} onReset={resetFilters} />}
        {!loading && !error && <ResultsTable stocks={filteredStocks} allStocks={allStocks} signaux={filters.signaux} />}
      </main>
    </div>
  )
}
