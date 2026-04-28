import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LetterGrade } from "@/components/LetterGrade"
import { formatPrice, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Stock } from "@/types/stock"
import type { DbPosition } from "@/contexts/PortfolioContext"
import { usePortfolio } from "@/contexts/PortfolioContext"

function tradeCurrency(currency: string | undefined): string {
  return currency === "GBp" ? "GBP" : (currency ?? "EUR")
}

export interface EnrichedPosition extends DbPosition {
  stock: Stock | undefined
  currentPrice: number | null
  value: number
  valueEur: number
  cost: number
  pl: number
  plPercent: number
  weight: number
  score: number | null
}

interface PositionsTableProps {
  positions: EnrichedPosition[]
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const { openTradeModal } = usePortfolio()

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Aucune position ouverte. Achetez une action depuis le Screener ou une fiche action.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Action</th>
            <th className="px-4 py-2.5 text-right font-medium">Poids</th>
            <th className="px-4 py-2.5 text-right font-medium">PRU</th>
            <th className="px-4 py-2.5 text-right font-medium">Cours</th>
            <th className="px-4 py-2.5 text-right font-medium">P/L</th>
            <th className="px-4 py-2.5 text-right font-medium">P/L %</th>
            <th className="px-4 py-2.5 text-right font-medium">Score</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {positions.map((pos) => {
            const isPos = pos.pl >= 0
            return (
              <tr key={pos.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    to={`/stock/${pos.ticker}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {pos.ticker}
                  </Link>
                  {pos.stock && (
                    <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {pos.stock.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{pos.quantity} actions</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {pos.weight.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPrice(pos.avg_price, tradeCurrency(pos.stock?.currency))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {pos.currentPrice != null
                    ? formatPrice(pos.currentPrice, tradeCurrency(pos.stock?.currency))
                    : "—"}
                </td>
                <td className={cn("px-4 py-3 text-right tabular-nums font-medium", isPos ? "text-emerald-600" : "text-red-500")}>
                  {isPos ? "+" : ""}
                  {formatPrice(pos.pl, tradeCurrency(pos.stock?.currency))}
                </td>
                <td className={cn("px-4 py-3 text-right tabular-nums font-medium", isPos ? "text-emerald-600" : "text-red-500")}>
                  {formatPercent(pos.plPercent, true)}
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.score != null ? (
                    <LetterGrade score={pos.score} size="sm" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.stock && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => openTradeModal(pos.stock!, "sell")}
                    >
                      Vendre
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
