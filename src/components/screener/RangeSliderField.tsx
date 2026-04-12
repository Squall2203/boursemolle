import { X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { RangeFilter } from "@/types/filters"

interface RangeSliderFieldProps {
  label: string
  value: RangeFilter
  onChange: (value: RangeFilter) => void
  min: number
  max: number
  step: number
  formatValue?: (n: number) => string
}

export function RangeSliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue = (n) => n.toString(),
}: RangeSliderFieldProps) {
  const isActive = value.min > min || value.max < max

  return (
    <div
      className={cn(
        "space-y-2 rounded-md p-2 -mx-2 transition-colors",
        isActive && "bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
          {isActive && (
            <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary" />
          )}
        </Label>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              isActive ? "font-semibold text-primary" : "text-foreground",
            )}
          >
            {formatValue(value.min)} – {formatValue(value.max)}
          </span>
          {isActive && (
            <button
              type="button"
              onClick={() => onChange({ min, max })}
              className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Réinitialiser ce filtre"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>
      <Slider
        value={[value.min, value.max]}
        min={min}
        max={max}
        step={step}
        onValueChange={(arr) => {
          if (arr.length === 2) onChange({ min: arr[0], max: arr[1] })
        }}
      />
    </div>
  )
}
