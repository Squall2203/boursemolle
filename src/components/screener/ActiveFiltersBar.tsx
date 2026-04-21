import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  FILTER_BOUNDS,
  DEFAULT_FILTERS,
  isRangeActive,
  type ScreenerFilters,
  type RangeFilter,
} from "@/types/filters"
import { FLAG_CATALOG } from "@/lib/scoring"

interface ActiveFiltersBarProps {
  filters: ScreenerFilters
  onChange: (next: Partial<ScreenerFilters>) => void
  onReset: () => void
}

interface FilterChip {
  key: string
  label: string
  onDismiss: () => void
}

function rangeLabel(name: string, range: RangeFilter, bounds: { min: number; max: number }, format?: (n: number) => string) {
  const fmt = format ?? ((n: number) => n.toString())
  if (range.min > bounds.min && range.max < bounds.max) {
    return `${name} ${fmt(range.min)} – ${fmt(range.max)}`
  }
  if (range.min > bounds.min) {
    return `${name} ≥ ${fmt(range.min)}`
  }
  return `${name} ≤ ${fmt(range.max)}`
}

export function ActiveFiltersBar({ filters, onChange, onReset }: ActiveFiltersBarProps) {
  const chips: FilterChip[] = []

  if (filters.freshnessMaxDays > 0) {
    const labels: Record<number, string> = { 3: "MAJ < 3j 🟢", 7: "MAJ < 7j 🟡", 14: "MAJ < 14j 🟠" }
    chips.push({
      key: "freshnessMaxDays",
      label: labels[filters.freshnessMaxDays] ?? `MAJ < ${filters.freshnessMaxDays}j`,
      onDismiss: () => onChange({ freshnessMaxDays: 0 }),
    })
  }

  if (isRangeActive(filters.scoreGlobal, FILTER_BOUNDS.scoreGlobal)) {
    chips.push({
      key: "scoreGlobal",
      label: rangeLabel("Score", filters.scoreGlobal, FILTER_BOUNDS.scoreGlobal, (n) => n.toFixed(1)),
      onDismiss: () => onChange({ scoreGlobal: DEFAULT_FILTERS.scoreGlobal }),
    })
  }

  const subScoreFields = [
    { key: "scoreValorisation" as const, label: "Valo." },
    { key: "scoreQualite" as const, label: "Qualité" },
    { key: "scoreCroissance" as const, label: "Croiss." },
    { key: "scoreSante" as const, label: "Santé" },
    { key: "scoreDividende" as const, label: "Div." },
    { key: "scoreMomentum" as const, label: "Mom." },
    { key: "scoreQuant" as const, label: "Quant" },
  ] as const
  for (const { key, label } of subScoreFields) {
    if (isRangeActive(filters[key], FILTER_BOUNDS[key])) {
      chips.push({
        key,
        label: rangeLabel(label, filters[key], FILTER_BOUNDS[key], (n) => n.toFixed(1)),
        onDismiss: () => onChange({ [key]: DEFAULT_FILTERS[key] }),
      })
    }
  }

  if (isRangeActive(filters.marketCap, FILTER_BOUNDS.marketCap)) {
    chips.push({
      key: "marketCap",
      label: rangeLabel("Capi", filters.marketCap, FILTER_BOUNDS.marketCap, (n) => `${n} Md€`),
      onDismiss: () => onChange({ marketCap: DEFAULT_FILTERS.marketCap }),
    })
  }

  if (isRangeActive(filters.pe, FILTER_BOUNDS.pe)) {
    chips.push({
      key: "pe",
      label: rangeLabel("P/E", filters.pe, FILTER_BOUNDS.pe),
      onDismiss: () => onChange({ pe: DEFAULT_FILTERS.pe }),
    })
  }

  if (isRangeActive(filters.roe, FILTER_BOUNDS.roe)) {
    chips.push({
      key: "roe",
      label: rangeLabel("ROE", filters.roe, FILTER_BOUNDS.roe, (n) => `${n}%`),
      onDismiss: () => onChange({ roe: DEFAULT_FILTERS.roe }),
    })
  }

  if (isRangeActive(filters.divYield, FILTER_BOUNDS.divYield)) {
    chips.push({
      key: "divYield",
      label: rangeLabel("Dividende", filters.divYield, FILTER_BOUNDS.divYield, (n) => `${n.toFixed(1)}%`),
      onDismiss: () => onChange({ divYield: DEFAULT_FILTERS.divYield }),
    })
  }

  if (isRangeActive(filters.rsi, FILTER_BOUNDS.rsi)) {
    chips.push({
      key: "rsi",
      label: rangeLabel("RSI", filters.rsi, FILTER_BOUNDS.rsi),
      onDismiss: () => onChange({ rsi: DEFAULT_FILTERS.rsi }),
    })
  }

  if (isRangeActive(filters.perf1M, FILTER_BOUNDS.perf1M)) {
    chips.push({
      key: "perf1M",
      label: rangeLabel("Perf 1M", filters.perf1M, FILTER_BOUNDS.perf1M, (n) => `${n > 0 ? "+" : ""}${n}%`),
      onDismiss: () => onChange({ perf1M: DEFAULT_FILTERS.perf1M }),
    })
  }

  if (isRangeActive(filters.perf6M, FILTER_BOUNDS.perf6M)) {
    chips.push({
      key: "perf6M",
      label: rangeLabel("Perf 6M", filters.perf6M, FILTER_BOUNDS.perf6M, (n) => `${n > 0 ? "+" : ""}${n}%`),
      onDismiss: () => onChange({ perf6M: DEFAULT_FILTERS.perf6M }),
    })
  }

  if (isRangeActive(filters.perf1Y, FILTER_BOUNDS.perf1Y)) {
    chips.push({
      key: "perf1Y",
      label: rangeLabel("Perf 1A", filters.perf1Y, FILTER_BOUNDS.perf1Y, (n) => `${n > 0 ? "+" : ""}${n}%`),
      onDismiss: () => onChange({ perf1Y: DEFAULT_FILTERS.perf1Y }),
    })
  }

  for (const index of filters.indices) {
    chips.push({
      key: `index-${index}`,
      label: index,
      onDismiss: () => onChange({ indices: filters.indices.filter((i) => i !== index) }),
    })
  }

  for (const sector of filters.sectors) {
    chips.push({
      key: `sector-${sector}`,
      label: sector,
      onDismiss: () => onChange({ sectors: filters.sectors.filter((s) => s !== sector) }),
    })
  }

  for (const country of filters.countries) {
    chips.push({
      key: `country-${country}`,
      label: country,
      onDismiss: () => onChange({ countries: filters.countries.filter((c) => c !== country) }),
    })
  }

  for (const sig of filters.signaux) {
    const flag = FLAG_CATALOG.find((f) => f.id === sig)
    chips.push({
      key: `signal-${sig}`,
      label: flag ? `${flag.emoji} ${flag.label}` : sig,
      onDismiss: () => onChange({ signaux: filters.signaux.filter((s) => s !== sig) }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground mr-1">Filtres actifs :</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pl-2 pr-1 text-xs font-normal"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onDismiss}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
        >
          Tout effacer
        </button>
      )}
    </div>
  )
}
