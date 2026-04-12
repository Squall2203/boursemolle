import { useState } from "react"
import { Activity, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { analyzeTechnicals, type TechnicalAnalysis } from "@/lib/technicalAnalysis"
import type { PriceCandle } from "@/types/stock"

interface TechnicalAnalysisPanelProps {
  candles: PriceCandle[]
  currency: string
}

function SignalIcon({ signal }: { signal: TechnicalAnalysis["signal"] }) {
  switch (signal) {
    case "Haussier": return <TrendingUp className="size-5" />
    case "Baissier": return <TrendingDown className="size-5" />
    case "Neutre": return <Minus className="size-5" />
  }
}

function formatPrice(n: number, currency: string) {
  const symbol = currency === "EUR" ? "€" : currency
  return `${n.toFixed(2)} ${symbol}`
}

export function TechnicalAnalysisPanel({ candles, currency }: TechnicalAnalysisPanelProps) {
  const [visible, setVisible] = useState(false)
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null)

  function handleClick() {
    if (!visible) {
      const result = analyzeTechnicals(candles)
      setAnalysis(result)
    }
    setVisible(!visible)
  }

  return (
    <section className="space-y-4">
      <Button
        variant="outline"
        onClick={handleClick}
        className="gap-2"
      >
        <Activity className="size-4" />
        Analyse technique
        {visible ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>

      {visible && analysis && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={cn("flex size-12 items-center justify-center rounded-full bg-muted", analysis.signalColor)}>
                  <SignalIcon signal={analysis.signal} />
                </div>
                <div>
                  <div className={cn("text-lg font-semibold", analysis.signalColor)}>
                    {analysis.signal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Signal technique global
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                Confiance : <span className="font-semibold text-foreground">{analysis.confidence}%</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Moyennes mobiles
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y text-sm">
                {([
                  ["SMA 20", analysis.sma.sma20, analysis.sma.priceVsSma20],
                  ["SMA 50", analysis.sma.sma50, analysis.sma.priceVsSma50],
                  ["SMA 200", analysis.sma.sma200, analysis.sma.priceVsSma200],
                ] as const).map(([label, value, pct]) => (
                  <div key={label} className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="text-right">
                      <span className="font-mono tabular-nums">
                        {value != null ? formatPrice(value, currency) : "—"}
                      </span>
                      {pct != null && (
                        <span className={cn(
                          "ml-2 text-xs font-medium",
                          pct > 0 ? "text-emerald-600" : "text-red-600",
                        )}>
                          {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Momentum
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">RSI (14)</span>
                  <span className={cn(
                    "font-mono font-semibold tabular-nums",
                    analysis.rsi.value > 70
                      ? "text-red-600"
                      : analysis.rsi.value < 30
                        ? "text-emerald-600"
                        : "",
                  )}>
                    {analysis.rsi.value}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-[30%] w-px bg-border" />
                  <div className="absolute inset-y-0 left-[70%] w-px bg-border" />
                  <div
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                    style={{ left: `${Math.min(100, analysis.rsi.value)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Survendu</span>
                  <span>Neutre</span>
                  <span>Suracheté</span>
                </div>
                <p className="text-xs text-muted-foreground">{analysis.rsi.interpretation}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Supports & Résistances
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {analysis.supportResistance.resistances.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-red-600">Résistances</div>
                    {analysis.supportResistance.resistances.map((r) => (
                      <div key={r} className="flex items-center justify-between py-0.5">
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatPrice(r, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {analysis.supportResistance.supports.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-emerald-600">Supports</div>
                    {analysis.supportResistance.supports.map((s) => (
                      <div key={s} className="flex items-center justify-between py-0.5">
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatPrice(s, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {analysis.supportResistance.supports.length === 0 &&
                  analysis.supportResistance.resistances.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pas de niveaux significatifs détectés.
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>

          {analysis.crossovers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Croisements SMA 50/200
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.crossovers.map((c) => (
                    <Badge
                      key={c.date}
                      variant="outline"
                      className={cn(
                        "gap-1",
                        c.type === "golden"
                          ? "text-emerald-600 border-emerald-300"
                          : "text-red-600 border-red-300",
                      )}
                    >
                      {c.type === "golden" ? "Golden Cross" : "Death Cross"}
                      <span className="text-muted-foreground">
                        — {c.date} ({c.daysAgo}j)
                      </span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Volume dernier jour</span>
                <span className="font-mono tabular-nums">
                  {analysis.volume.latestVolume.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Moyenne 20 jours</span>
                <span className="font-mono tabular-nums">
                  {analysis.volume.avgVolume20.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Ratio</span>
                <span className="font-mono tabular-nums">{analysis.volume.ratio}x</span>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Détails de l'analyse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {analysis.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    {d}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {visible && !analysis && (
        <p className="text-sm text-muted-foreground">
          Pas assez de données pour effectuer l'analyse technique.
        </p>
      )}
    </section>
  )
}
