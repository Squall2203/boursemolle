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

function isPresetActive(preset: Preset, filters: ScreenerFilters): boolean {
  const target = { ...DEFAULT_FILTERS, ...preset.filters }
  return (
    filters.pe.min === target.pe.min &&
    filters.pe.max === target.pe.max &&
    filters.roe.min === target.roe.min &&
    filters.roe.max === target.roe.max &&
    filters.divYield.min === target.divYield.min &&
    filters.divYield.max === target.divYield.max &&
    filters.marketCap.min === target.marketCap.min &&
    filters.marketCap.max === target.marketCap.max &&
    filters.rsi.min === target.rsi.min &&
    filters.rsi.max === target.rsi.max &&
    filters.perf1M.min === target.perf1M.min &&
    filters.perf1M.max === target.perf1M.max &&
    filters.perf6M.min === target.perf6M.min &&
    filters.perf6M.max === target.perf6M.max &&
    filters.perf1Y.min === target.perf1Y.min &&
    filters.perf1Y.max === target.perf1Y.max
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
