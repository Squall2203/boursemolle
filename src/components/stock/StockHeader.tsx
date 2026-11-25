import { ArrowLeft, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LetterGrade } from "@/components/LetterGrade"
import { getGrade } from "@/lib/grades"
import { useViewMode } from "@/hooks/useViewMode"
import { cn } from "@/lib/utils"
import { formatMarketCap, formatPercent, formatPrice } from "@/lib/format"
import { getStockRegion } from "@/lib/market"
import { ScoreExplanationCard } from "@/components/stock/ScoreExplanation"
import type { StockScore } from "@/lib/scoring"
import type { Stock } from "@/types/stock"

interface StockHeaderProps {
  stock: Stock
  score: StockScore
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 6) return "text-green-600 dark:text-green-400"
  if (score >= 4) return "text-yellow-600 dark:text-yellow-400"
  if (score >= 2) return "text-orange-600 dark:text-orange-400"
  return "text-red-600 dark:text-red-400"
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-500/20"
  if (score >= 6) return "bg-green-500/20"
  if (score >= 4) return "bg-yellow-500/20"
  if (score >= 2) return "bg-orange-500/20"
  return "bg-red-500/20"
}

export function StockHeader({ stock, score }: StockHeaderProps) {
  const { isSimple } = useViewMode()

  const changeClass =
    stock.priceChangePercent == null
      ? ""
      : stock.priceChangePercent > 0
        ? "text-emerald-600"
        : stock.priceChangePercent < 0
          ? "text-red-600"
          : ""

  const grade = getGrade(score.total)

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{stock.name}</h1>
            {stock.peaEligible ? (
              <Badge variant="secondary" className="text-xs uppercase text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                🇪🇺 PEA
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {getStockRegion(stock) === "us" ? "🇺🇸 CTO uniquement" : getStockRegion(stock) === "asia" ? "🌏 CTO uniquement" : "Hors PEA"}
              </Badge>
            )}
          </div>
          {!isSimple && (
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
          )}
          {score.flags.length > 0 && (
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {score.flags.map((flag) => (
                  <Tooltip key={flag.id}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn("gap-1 text-xs cursor-help", flag.color)}>
                        {flag.emoji} {flag.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {flag.detail}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">
            {formatPrice(stock.price, stock.currency)}
          </div>
          <div className={cn("text-sm font-medium tabular-nums", changeClass)}>
            {formatPercent(stock.priceChangePercent, true)} aujourd'hui
          </div>
          <div className="text-xs text-muted-foreground">
            Capi. {formatMarketCap(stock.marketCapEur ?? null, "EUR")}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            {isSimple ? (
              <LetterGrade score={score.total} size="lg" />
            ) : (
              <div className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", scoreBg(score.total))}>
                <span className={cn("text-xl font-bold tabular-nums", scoreColor(score.total))}>
                  {score.total.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className={cn("text-base font-semibold", grade.color)}>
                {grade.label}
                {isSimple && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {score.total.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 10
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{score.summary}</p>
              {!isSimple && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  Comparée à {score.sectorContext.count} sociétés du secteur {score.sectorContext.name}
                  {score.sectorContext.isSmall && " (échantillon réduit : grille générale utilisée)"}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ScoreExplanationCard score={score} showFigures={!isSimple} />
      <p className="text-center text-xs text-muted-foreground">
        <Link to="/methodologie" className="hover:text-primary hover:underline">
          Lire la méthode de calcul complète
        </Link>
        {" · "}Cette note est une aide à l'analyse, pas un conseil d'achat ou de vente.
      </p>
    </div>
  )
}
