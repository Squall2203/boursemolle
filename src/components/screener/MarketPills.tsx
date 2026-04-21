import { cn } from "@/lib/utils"
import type { MarketFilter } from "@/lib/market"

interface MarketPillsProps {
  value: MarketFilter
  onChange: (market: MarketFilter) => void
  counts?: Record<MarketFilter, number>
}

const PILLS: { id: MarketFilter; label: string; flag: string }[] = [
  { id: "", label: "Tous", flag: "🌍" },
  { id: "pea", label: "Europe PEA", flag: "🇪🇺" },
  { id: "us", label: "États-Unis", flag: "🇺🇸" },
  { id: "asia", label: "Asie", flag: "🌏" },
]

export function MarketPills({ value, onChange, counts }: MarketPillsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PILLS.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => onChange(pill.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
            value === pill.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <span>{pill.flag}</span>
          <span>{pill.label}</span>
          {counts && counts[pill.id] != null && (
            <span className={cn("tabular-nums", value === pill.id ? "text-primary/70" : "text-muted-foreground/60")}>
              {counts[pill.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
