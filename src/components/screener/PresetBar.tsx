import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PRESETS, type Preset } from "@/lib/presets"
import { DEFAULT_FILTERS, type ScreenerFilters } from "@/types/filters"

interface PresetBarProps {
  filters: ScreenerFilters
  onApply: (filters: Partial<ScreenerFilters>) => void
  onReset: () => void
}

function rangeEq(a: { min: number; max: number }, b: { min: number; max: number }) {
  return a.min === b.min && a.max === b.max
}

function isPresetActive(preset: Preset, filters: ScreenerFilters): boolean {
  const t = { ...DEFAULT_FILTERS, ...preset.filters }
  return (
    rangeEq(filters.pe, t.pe) &&
    rangeEq(filters.roe, t.roe) &&
    rangeEq(filters.divYield, t.divYield) &&
    rangeEq(filters.marketCap, t.marketCap) &&
    rangeEq(filters.rsi, t.rsi) &&
    rangeEq(filters.perf1M, t.perf1M) &&
    rangeEq(filters.perf6M, t.perf6M) &&
    rangeEq(filters.perf1Y, t.perf1Y) &&
    rangeEq(filters.scoreGlobal, t.scoreGlobal) &&
    rangeEq(filters.scoreValorisation, t.scoreValorisation) &&
    rangeEq(filters.scoreQualite, t.scoreQualite) &&
    rangeEq(filters.scoreCroissance, t.scoreCroissance) &&
    rangeEq(filters.scoreSante, t.scoreSante) &&
    rangeEq(filters.scoreDividende, t.scoreDividende) &&
    rangeEq(filters.scoreMomentum, t.scoreMomentum) &&
    rangeEq(filters.scoreQuant, t.scoreQuant) &&
    filters.market === (t.market ?? "")
  )
}

export function PresetBar({ filters, onApply, onReset }: PresetBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = isPresetActive(preset, filters)
          return (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 text-xs", active && "shadow-sm")}
                  onClick={() => {
                    if (active) {
                      onReset()
                    } else {
                      onApply({ ...DEFAULT_FILTERS, ...preset.filters })
                    }
                  }}
                >
                  {preset.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64 p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  {preset.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preset.criteria.map((c) => (
                    <Badge key={c.label} variant="secondary" className="text-xs gap-1">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-semibold">{c.value}</span>
                    </Badge>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={onReset}
        >
          Tout afficher
        </Button>
      </div>
    </TooltipProvider>
  )
}
