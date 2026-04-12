import { ArrowLeft, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatMarketCap, formatPercent, formatPrice } from "@/lib/format"
import type { StockScore } from "@/lib/scoring"
import type { Stock } from "@/types/stock"

interface StockHeaderProps {
  stock: Stock
  score: StockScore
}

export function StockHeader({ stock, score }: StockHeaderProps) {
  const changeClass =
    stock.priceChangePercent == null
      ? ""
      : stock.priceChangePercent > 0
        ? "text-emerald-600"
        : stock.priceChangePercent < 0
          ? "text-red-600"
          : ""

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link to="/screener">
          <ArrowLeft className="size-4" />
          Screener
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{stock.name}</h1>
            {stock.peaEligible && (
              <Badge variant="secondary" className="text-xs uppercase">
                PEA
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground">
              {stock.ticker}
            </span>
            <span>·</span>
            <span>{stock.exchange}</span>
            <span>·</span>
            <span>{stock.sector ?? "—"}</span>
            <span>·</span>
            <span>{stock.country}</span>
            {stock.website && (
              <>
                <span>·</span>
                <a
                  href={stock.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Site web
                  <ExternalLink className="size-3" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">
            {formatPrice(stock.price, stock.currency)}
          </div>
          <div className={cn("text-sm font-medium tabular-nums", changeClass)}>
            {formatPercent(stock.priceChangePercent, true)} aujourd'hui
          </div>
          <div className="text-xs text-muted-foreground">
            Capi. {formatMarketCap(stock.marketCap)}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <span className="text-lg font-bold tabular-nums">
                {score.total.toFixed(1)}
              </span>
            </div>
            <div>
              <div className={cn("text-sm font-semibold", score.labelColor)}>
                {score.label}
              </div>
              <div className="text-xs text-muted-foreground">Score global</div>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="grid grid-cols-4 gap-4 text-center text-xs">
            {(
              [
                ["Valorisation", score.pillars.valuation],
                ["Qualité", score.pillars.quality],
                ["Croissance", score.pillars.growth],
                ["Dividende", score.pillars.dividend],
              ] as const
            ).map(([label, val]) => (
              <div key={label}>
                <div className="font-semibold tabular-nums">
                  {val.toFixed(1)}
                </div>
                <div className="text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <div className="h-8 w-px bg-border" />
          <p className="text-sm text-muted-foreground">{score.summary}</p>
        </CardContent>
      </Card>
    </div>
  )
}
