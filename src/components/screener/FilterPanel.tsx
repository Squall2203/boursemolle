import { RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { FILTER_BOUNDS, isRangeActive, type ScreenerFilters } from "@/types/filters"
import { RangeSliderField } from "./RangeSliderField"
import { MultiSelectField } from "./MultiSelectField"

interface FilterPanelProps {
  filters: ScreenerFilters
  onChange: (next: Partial<ScreenerFilters>) => void
  onReset: () => void
  availableSectors: string[]
  availableCountries: string[]
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  availableSectors,
  availableCountries,
}: FilterPanelProps) {
  const valuationActive = isRangeActive(filters.marketCap, FILTER_BOUNDS.marketCap) || isRangeActive(filters.pe, FILTER_BOUNDS.pe)
  const profitActive = isRangeActive(filters.roe, FILTER_BOUNDS.roe)
  const yieldActive = isRangeActive(filters.divYield, FILTER_BOUNDS.divYield)
  const qualActive = filters.sectors.length > 0 || filters.countries.length > 0

  const activeCount =
    (isRangeActive(filters.marketCap, FILTER_BOUNDS.marketCap) ? 1 : 0) +
    (isRangeActive(filters.pe, FILTER_BOUNDS.pe) ? 1 : 0) +
    (profitActive ? 1 : 0) +
    (yieldActive ? 1 : 0) +
    (filters.sectors.length > 0 ? 1 : 0) +
    (filters.countries.length > 0 ? 1 : 0)

  return (
    <Card className="sticky top-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Filtres
          {activeCount > 0 && (
            <Badge variant="default" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-bold">
              {activeCount}
            </Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onReset}
        >
          <RotateCcw className="size-3" />
          Réinitialiser
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-4">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            valuationActive ? "text-primary" : "text-foreground",
          )}>
            Valorisation
            {valuationActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <RangeSliderField
            label="Capitalisation (Md€)"
            value={filters.marketCap}
            onChange={(v) => onChange({ marketCap: v })}
            min={FILTER_BOUNDS.marketCap.min}
            max={FILTER_BOUNDS.marketCap.max}
            step={FILTER_BOUNDS.marketCap.step}
            formatValue={(n) => `${n}`}
          />
          <RangeSliderField
            label="P/E (TTM)"
            value={filters.pe}
            onChange={(v) => onChange({ pe: v })}
            min={FILTER_BOUNDS.pe.min}
            max={FILTER_BOUNDS.pe.max}
            step={FILTER_BOUNDS.pe.step}
          />
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            profitActive ? "text-primary" : "text-foreground",
          )}>
            Profitabilité
            {profitActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <RangeSliderField
            label="ROE (%)"
            value={filters.roe}
            onChange={(v) => onChange({ roe: v })}
            min={FILTER_BOUNDS.roe.min}
            max={FILTER_BOUNDS.roe.max}
            step={FILTER_BOUNDS.roe.step}
          />
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            yieldActive ? "text-primary" : "text-foreground",
          )}>
            Rendement
            {yieldActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <RangeSliderField
            label="Dividende (%)"
            value={filters.divYield}
            onChange={(v) => onChange({ divYield: v })}
            min={FILTER_BOUNDS.divYield.min}
            max={FILTER_BOUNDS.divYield.max}
            step={FILTER_BOUNDS.divYield.step}
            formatValue={(n) => n.toFixed(1)}
          />
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            qualActive ? "text-primary" : "text-foreground",
          )}>
            Qualitatif
            {qualActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <MultiSelectField
            label="Secteur"
            options={availableSectors}
            value={filters.sectors}
            onChange={(v) => onChange({ sectors: v })}
            searchPlaceholder="Rechercher un secteur..."
          />
          <MultiSelectField
            label="Pays"
            options={availableCountries}
            value={filters.countries}
            onChange={(v) => onChange({ countries: v })}
            searchPlaceholder="Rechercher un pays..."
          />
        </section>
      </CardContent>
    </Card>
  )
}
