import { cn } from "@/lib/utils"
import { formatPrice, formatPercent } from "@/lib/format"

interface PortfolioStatsProps {
  totalValue: number
  initialCapital: number
  cashBalance: number
  avgScore: number | null
  benchmarkReturn?: number | null
}

export function PortfolioStats({
  totalValue,
  initialCapital,
  cashBalance,
  avgScore,
  benchmarkReturn,
}: PortfolioStatsProps) {
  const returnEuro = totalValue - initialCapital
  const returnPct = ((totalValue - initialCapital) / initialCapital) * 100
  const isPositive = returnPct >= 0
  const alpha = benchmarkReturn != null ? returnPct - benchmarkReturn : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Valeur totale"
        value={formatPrice(totalValue)}
        sub={
          <span className={cn("text-xs font-medium", isPositive ? "text-emerald-600" : "text-red-500")}>
            {returnEuro >= 0 ? "+" : ""}
            {formatPrice(returnEuro)} ({formatPercent(returnPct, true)})
          </span>
        }
      />
      <StatCard
        label="Solde cash"
        value={formatPrice(cashBalance)}
        sub={
          <span className="text-xs text-muted-foreground">
            {((cashBalance / totalValue) * 100).toFixed(0)}% du portefeuille
          </span>
        }
      />
      <StatCard
        label="Performance"
        value={
          <span className={cn("font-bold", isPositive ? "text-emerald-600" : "text-red-500")}>
            {formatPercent(returnPct, true)}
          </span>
        }
        sub={
          alpha != null ? (
            <span className={cn("text-xs font-medium", alpha >= 0 ? "text-emerald-600" : "text-red-500")}>
              vs S&P 500 : {alpha >= 0 ? "+" : ""}
              {alpha.toFixed(2)}%
            </span>
          ) : null
        }
      />
      <StatCard
        label="Score moyen"
        value={
          avgScore != null ? (
            <span className="font-bold">{avgScore.toFixed(1)}/10</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        }
        sub={
          avgScore != null ? (
            <span className="text-xs text-muted-foreground">
              {avgScore >= 8 ? "A+" : avgScore >= 7 ? "A" : avgScore >= 6 ? "B+" : avgScore >= 5 ? "B" : "C"}
            </span>
          ) : null
        }
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold leading-tight">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  )
}
