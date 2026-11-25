import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FILTER_BOUNDS, type ScreenerFilters } from "@/types/filters"

/** Noms des secteurs en français (les données les fournissent en anglais). */
const SECTOR_LABELS: Record<string, string> = {
  "Technology": "Technologie",
  "Healthcare": "Santé",
  "Financial Services": "Finance",
  "Consumer Cyclical": "Consommation cyclique",
  "Consumer Defensive": "Consommation de base",
  "Industrials": "Industrie",
  "Communication Services": "Télécoms et médias",
  "Basic Materials": "Matériaux de base",
  "Real Estate": "Immobilier",
  "Energy": "Énergie",
  "Utilities": "Services aux collectivités",
}

const CAP = FILTER_BOUNDS.marketCap
const SIZES = [
  { id: "all", label: "Toutes tailles", range: { min: CAP.min, max: CAP.max } },
  { id: "large", label: "Grandes (plus de 10 Md€)", range: { min: 10, max: CAP.max } },
  { id: "mid", label: "Moyennes (2 à 10 Md€)", range: { min: 2, max: 10 } },
  { id: "small", label: "Petites (moins de 2 Md€)", range: { min: CAP.min, max: 2 } },
]

const DIV = FILTER_BOUNDS.divYield
const DIVIDENDS = [
  { id: "all", label: "Avec ou sans dividende", min: DIV.min },
  { id: "2", label: "Dividende d'au moins 2 %", min: 2 },
  { id: "4", label: "Dividende d'au moins 4 %", min: 4 },
]

interface SimpleFiltersProps {
  filters: ScreenerFilters
  onChange: (next: Partial<ScreenerFilters>) => void
  availableSectors: string[]
}

/** Les trois filtres les plus utiles, proposés en mode simple sans ouvrir le panneau expert. */
export function SimpleFilters({ filters, onChange, availableSectors }: SimpleFiltersProps) {
  const sector = filters.sectors.length === 1 ? filters.sectors[0] : "all"
  const size = SIZES.find((s) => s.range.min === filters.marketCap.min && s.range.max === filters.marketCap.max)?.id ?? "all"
  const dividend = DIVIDENDS.find((d) => d.min === filters.divYield.min)?.id ?? "all"

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={sector} onValueChange={(v) => onChange({ sectors: v === "all" ? [] : [v] })}>
        <SelectTrigger className="h-8 w-full text-xs sm:w-[210px]" aria-label="Secteur">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Tous les secteurs</SelectItem>
          {availableSectors.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">{SECTOR_LABELS[s] ?? s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={size} onValueChange={(v) => onChange({ marketCap: SIZES.find((s) => s.id === v)!.range })}>
        <SelectTrigger className="h-8 w-full text-xs sm:w-[210px]" aria-label="Taille de l'entreprise">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SIZES.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={dividend}
        onValueChange={(v) => onChange({ divYield: { min: DIVIDENDS.find((d) => d.id === v)!.min, max: DIV.max } })}
      >
        <SelectTrigger className="h-8 w-full text-xs sm:w-[210px]" aria-label="Dividende">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIVIDENDS.map((d) => (
            <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
