import { useState } from "react"
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Ban } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatMarketCap, formatPercent, formatPrice } from "@/lib/format"
import type { StockScore, PillarDetail, MetricDetail } from "@/lib/scoring"
import type { Stock } from "@/types/stock"

interface StockHeaderProps {
  stock: Stock
  score: StockScore
}

const PILLAR_LABELS: { key: keyof StockScore["pillars"]; label: string; weight: string }[] = [
  { key: "valorisation", label: "Valo", weight: "20%" },
  { key: "qualite", label: "Qual", weight: "20%" },
  { key: "croissance", label: "Crois", weight: "15%" },
  { key: "sante", label: "Santé", weight: "15%" },
  { key: "dividende", label: "Div", weight: "10%" },
  { key: "momentum", label: "Momen", weight: "10%" },
  { key: "quant", label: "Quant", weight: "10%" },
]

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

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-yellow-500" : score >= 3 ? "bg-orange-500" : "bg-red-500")}
        style={{ width: `${Math.max(score * 10, 2)}%` }}
      />
    </div>
  )
}

function MetricRow({ metric }: { metric: MetricDetail }) {
  if (metric.excluded) {
    return (
      <div className="flex items-center gap-2 opacity-50">
        <Ban className="size-3 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-muted-foreground line-through">{metric.label}</div>
        <div className="text-xs text-muted-foreground italic">{metric.excludedReason ?? "Exclu"}</div>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-muted-foreground">{metric.label}</div>
        <div className="font-mono tabular-nums w-16 text-right">{metric.displayValue}</div>
        <div className={cn("w-8 text-right font-mono font-semibold tabular-nums", scoreColor(metric.note))}>
          {metric.note.toFixed(1)}
        </div>
        <div className="w-16">
          <ScoreBar score={metric.note} />
        </div>
      </div>
      {metric.sectorMedian != null && (
        <div className="flex items-center gap-2 pl-2 text-[10px] text-muted-foreground/70">
          <span>Méd. secteur: <span className="font-mono">{metric.sectorMedian.toFixed(1)}</span></span>
          {metric.ratioVsSector != null && (
            <span>· Ratio: <span className={cn("font-mono", metric.ratioVsSector <= 0.9 ? "text-emerald-600 dark:text-emerald-400" : metric.ratioVsSector >= 1.3 ? "text-red-500" : "")}>{metric.ratioVsSector.toFixed(2)}x</span></span>
          )}
          {metric.sectorPercentile != null && (
            <span>· P{metric.sectorPercentile}</span>
          )}
        </div>
      )}
    </div>
  )
}

function PillarDetailPanel({ detail }: { detail: PillarDetail }) {
  const entries = Object.entries(detail)
  return (
    <div className="mt-2 space-y-2 text-xs">
      {entries.map(([key, metric]) => (
        <MetricRow key={key} metric={metric} />
      ))}
    </div>
  )
}

export function StockHeader({ stock, score }: StockHeaderProps) {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null)

  const changeClass =
    stock.priceChangePercent == null
      ? ""
      : stock.priceChangePercent > 0
        ? "text-emerald-600"
        : stock.priceChangePercent < 0
          ? "text-red-600"
          : ""

  function togglePillar(key: string) {
    setExpandedPillar((prev) => (prev === key ? null : key))
  }

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
            Capi. {formatMarketCap(stock.marketCap)}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4 pb-4">
          {/* Score global + verdict */}
          <div className="flex items-center gap-4">
            <div className={cn("flex size-14 items-center justify-center rounded-full", scoreBg(score.total))}>
              <span className={cn("text-xl font-bold tabular-nums", scoreColor(score.total))}>
                {score.total.toFixed(1)}
              </span>
            </div>
            <div className="flex-1">
              <div className={cn("text-sm font-semibold", score.labelColor)}>
                {score.label}
              </div>
              <p className="text-sm text-muted-foreground">{score.summary}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Secteur : {score.sectorContext.name} ({score.sectorContext.count} actions)
                {score.sectorContext.isSmall && " · échantillon réduit"}
              </p>
            </div>
          </div>

          {/* 7 piliers */}
          <div className="grid gap-1">
            {PILLAR_LABELS.map(({ key, label, weight }) => {
              const val = score.pillars[key]
              const isExpanded = expandedPillar === key
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => togglePillar(key)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-14 text-xs text-muted-foreground">{weight}</span>
                    <span className="w-16 text-left font-medium">{label}</span>
                    <div className="flex-1">
                      <ScoreBar score={val} />
                    </div>
                    <span className={cn("w-8 text-right font-mono font-semibold tabular-nums", scoreColor(val))}>
                      {val.toFixed(1)}
                    </span>
                    {isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="px-2 pb-2">
                      <PillarDetailPanel detail={score.details[key]} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="text-center pt-1">
            <Link to="/methodologie" className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors">
              Comment ce score est calculé
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
