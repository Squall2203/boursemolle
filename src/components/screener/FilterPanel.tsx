import { useState } from "react"
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { FILTER_BOUNDS, isRangeActive, type ScreenerFilters } from "@/types/filters"
import { FLAG_CATALOG } from "@/lib/scoring"
import { RangeSliderField } from "./RangeSliderField"
import { MultiSelectField } from "./MultiSelectField"

const AVAILABLE_INDICES = [
  "CAC 40",
  "CAC Next 20",
  "CAC Mid 60",
  "SBF 120",
  "DAX 40",
  "AEX 25",
  "BEL 20",
  "IBEX 35",
]

interface FilterPanelProps {
  filters: ScreenerFilters
  onChange: (next: Partial<ScreenerFilters>) => void
  onReset: () => void
  availableSectors: string[]
  availableCountries: string[]
  badgeCounts?: Map<string, number>
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  availableSectors,
  availableCountries,
  badgeCounts,
}: FilterPanelProps) {
  const [subScoresOpen, setSubScoresOpen] = useState(false)

  const scoreGlobalActive = isRangeActive(filters.scoreGlobal, FILTER_BOUNDS.scoreGlobal)
  const scoreSubActive =
    isRangeActive(filters.scoreValorisation, FILTER_BOUNDS.scoreValorisation) ||
    isRangeActive(filters.scoreQualite, FILTER_BOUNDS.scoreQualite) ||
    isRangeActive(filters.scoreCroissance, FILTER_BOUNDS.scoreCroissance) ||
    isRangeActive(filters.scoreSante, FILTER_BOUNDS.scoreSante) ||
    isRangeActive(filters.scoreDividende, FILTER_BOUNDS.scoreDividende) ||
    isRangeActive(filters.scoreMomentum, FILTER_BOUNDS.scoreMomentum) ||
    isRangeActive(filters.scoreQuant, FILTER_BOUNDS.scoreQuant)
  const scoreActive = scoreGlobalActive || scoreSubActive

  const valuationActive = isRangeActive(filters.marketCap, FILTER_BOUNDS.marketCap) || isRangeActive(filters.pe, FILTER_BOUNDS.pe)
  const profitActive = isRangeActive(filters.roe, FILTER_BOUNDS.roe)
  const yieldActive = isRangeActive(filters.divYield, FILTER_BOUNDS.divYield)
  const qualActive = filters.indices.length > 0 || filters.sectors.length > 0 || filters.countries.length > 0
  const techActive =
    isRangeActive(filters.rsi, FILTER_BOUNDS.rsi) ||
    isRangeActive(filters.perf1M, FILTER_BOUNDS.perf1M) ||
    isRangeActive(filters.perf6M, FILTER_BOUNDS.perf6M) ||
    isRangeActive(filters.perf1Y, FILTER_BOUNDS.perf1Y)

  const freshnessActive = filters.freshnessMaxDays > 0

  const activeCount =
    (freshnessActive ? 1 : 0) +
    (scoreGlobalActive ? 1 : 0) +
    (isRangeActive(filters.scoreValorisation, FILTER_BOUNDS.scoreValorisation) ? 1 : 0) +
    (isRangeActive(filters.scoreQualite, FILTER_BOUNDS.scoreQualite) ? 1 : 0) +
    (isRangeActive(filters.scoreCroissance, FILTER_BOUNDS.scoreCroissance) ? 1 : 0) +
    (isRangeActive(filters.scoreSante, FILTER_BOUNDS.scoreSante) ? 1 : 0) +
    (isRangeActive(filters.scoreDividende, FILTER_BOUNDS.scoreDividende) ? 1 : 0) +
    (isRangeActive(filters.scoreMomentum, FILTER_BOUNDS.scoreMomentum) ? 1 : 0) +
    (isRangeActive(filters.scoreQuant, FILTER_BOUNDS.scoreQuant) ? 1 : 0) +
    (isRangeActive(filters.marketCap, FILTER_BOUNDS.marketCap) ? 1 : 0) +
    (isRangeActive(filters.pe, FILTER_BOUNDS.pe) ? 1 : 0) +
    (profitActive ? 1 : 0) +
    (yieldActive ? 1 : 0) +
    (isRangeActive(filters.rsi, FILTER_BOUNDS.rsi) ? 1 : 0) +
    (isRangeActive(filters.perf1M, FILTER_BOUNDS.perf1M) ? 1 : 0) +
    (isRangeActive(filters.perf6M, FILTER_BOUNDS.perf6M) ? 1 : 0) +
    (isRangeActive(filters.perf1Y, FILTER_BOUNDS.perf1Y) ? 1 : 0) +
    (filters.indices.length > 0 ? 1 : 0) +
    (filters.sectors.length > 0 ? 1 : 0) +
    (filters.countries.length > 0 ? 1 : 0) +
    (filters.signaux.length > 0 ? 1 : 0)

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
            scoreActive ? "text-primary" : "text-foreground",
          )}>
            Score BourseMolle
            {scoreActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <RangeSliderField
            label="Score global"
            value={filters.scoreGlobal}
            onChange={(v) => onChange({ scoreGlobal: v })}
            min={FILTER_BOUNDS.scoreGlobal.min}
            max={FILTER_BOUNDS.scoreGlobal.max}
            step={FILTER_BOUNDS.scoreGlobal.step}
            formatValue={(n) => n.toFixed(1)}
          />
          <button
            type="button"
            onClick={() => setSubScoresOpen((o) => !o)}
            className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {subScoresOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            Sous-scores
            {scoreSubActive && <span className="ml-1 inline-flex size-1.5 rounded-full bg-primary" />}
          </button>
          {subScoresOpen && (
            <div className="space-y-3 pl-3 border-l border-border">
              <RangeSliderField
                label="Valorisation"
                value={filters.scoreValorisation}
                onChange={(v) => onChange({ scoreValorisation: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Qualité"
                value={filters.scoreQualite}
                onChange={(v) => onChange({ scoreQualite: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Croissance"
                value={filters.scoreCroissance}
                onChange={(v) => onChange({ scoreCroissance: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Santé financière"
                value={filters.scoreSante}
                onChange={(v) => onChange({ scoreSante: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Dividende"
                value={filters.scoreDividende}
                onChange={(v) => onChange({ scoreDividende: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Momentum"
                value={filters.scoreMomentum}
                onChange={(v) => onChange({ scoreMomentum: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
              <RangeSliderField
                label="Signaux quant"
                value={filters.scoreQuant}
                onChange={(v) => onChange({ scoreQuant: v })}
                min={0} max={10} step={0.5}
                formatValue={(n) => n.toFixed(1)}
              />
            </div>
          )}
        </section>

        <Separator />

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
            techActive ? "text-primary" : "text-foreground",
          )}>
            Technique
            {techActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <RangeSliderField
            label="RSI (14)"
            value={filters.rsi}
            onChange={(v) => onChange({ rsi: v })}
            min={FILTER_BOUNDS.rsi.min}
            max={FILTER_BOUNDS.rsi.max}
            step={FILTER_BOUNDS.rsi.step}
          />
          <RangeSliderField
            label="Perf 1 mois (%)"
            value={filters.perf1M}
            onChange={(v) => onChange({ perf1M: v })}
            min={FILTER_BOUNDS.perf1M.min}
            max={FILTER_BOUNDS.perf1M.max}
            step={FILTER_BOUNDS.perf1M.step}
            formatValue={(n) => `${n > 0 ? "+" : ""}${n}`}
          />
          <RangeSliderField
            label="Perf 6 mois (%)"
            value={filters.perf6M}
            onChange={(v) => onChange({ perf6M: v })}
            min={FILTER_BOUNDS.perf6M.min}
            max={FILTER_BOUNDS.perf6M.max}
            step={FILTER_BOUNDS.perf6M.step}
            formatValue={(n) => `${n > 0 ? "+" : ""}${n}`}
          />
          <RangeSliderField
            label="Perf 1 an (%)"
            value={filters.perf1Y}
            onChange={(v) => onChange({ perf1Y: v })}
            min={FILTER_BOUNDS.perf1Y.min}
            max={FILTER_BOUNDS.perf1Y.max}
            step={FILTER_BOUNDS.perf1Y.step}
            formatValue={(n) => `${n > 0 ? "+" : ""}${n}`}
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
            label="Indice"
            options={AVAILABLE_INDICES}
            value={filters.indices}
            onChange={(v) => onChange({ indices: v })}
            searchPlaceholder="Rechercher un indice..."
          />
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

        <Separator />

        <section className="space-y-3">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            freshnessActive ? "text-primary" : "text-foreground",
          )}>
            Fraîcheur des données
            {freshnessActive && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <Select
            value={String(filters.freshnessMaxDays)}
            onValueChange={(v) => onChange({ freshnessMaxDays: Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" className="text-xs">Toutes les actions</SelectItem>
              <SelectItem value="3" className="text-xs">🟢 Mises à jour &lt; 3 jours</SelectItem>
              <SelectItem value="7" className="text-xs">🟢🟡 Mises à jour &lt; 7 jours</SelectItem>
              <SelectItem value="14" className="text-xs">🟢🟡🟠 Mises à jour &lt; 14 jours</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            filters.signaux.length > 0 ? "text-primary" : "text-foreground",
          )}>
            Signaux
            {filters.signaux.length > 0 && <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary align-middle" />}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {FLAG_CATALOG.map((flag) => {
              const active = filters.signaux.includes(flag.id)
              return (
                <button
                  key={flag.id}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? filters.signaux.filter((s) => s !== flag.id)
                      : [...filters.signaux, flag.id]
                    onChange({ signaux: next })
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    active
                      ? flag.type === "positive"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span>{flag.emoji}</span>
                  <span>{flag.label}</span>
                  {badgeCounts && (
                    <span className={cn(
                      "ml-0.5 font-mono text-[10px]",
                      active ? "opacity-80" : "opacity-50",
                    )}>
                      {badgeCounts.get(flag.id) ?? 0}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
