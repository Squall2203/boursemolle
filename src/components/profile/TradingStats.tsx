import type { TradingStats } from "@/hooks/useProfile"
import { formatPercent } from "@/lib/format"

interface TradingStatsCardProps {
  stats: TradingStats
  portfolioPerformance?: number | null
}

export function TradingStatsCard({ stats, portfolioPerformance }: TradingStatsCardProps) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <h3 className="mb-3 text-sm font-semibold">Statistiques</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Stat label="Ordres passés" value={String(stats.totalTrades)} />
        <Stat label="Achats" value={String(stats.totalBuys)} />
        <Stat label="Ventes" value={String(stats.totalSells)} />
        <Stat
          label="Activité"
          value={
            stats.daysSinceFirst != null
              ? `${stats.daysSinceFirst} j`
              : "—"
          }
        />
        <Stat label="Portefeuilles" value={String(stats.portfolioCount)} />
        {portfolioPerformance != null && (
          <Stat
            label="Performance totale"
            value={formatPercent(portfolioPerformance, true)}
            highlight={portfolioPerformance >= 0 ? "positive" : "negative"}
          />
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: "positive" | "negative"
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          highlight === "positive"
            ? "font-semibold text-emerald-600"
            : highlight === "negative"
              ? "font-semibold text-red-500"
              : "font-semibold"
        }
      >
        {value}
      </span>
    </div>
  )
}
