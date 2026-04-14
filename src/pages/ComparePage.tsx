import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CompareTable } from "@/components/compare/CompareTable"
import { NormalizedChart } from "@/components/compare/NormalizedChart"
import { StockSelector } from "@/components/compare/StockSelector"
import { LetterGrade } from "@/components/LetterGrade"
import { useStocks } from "@/hooks/useStocks"
import { useViewMode } from "@/hooks/useViewMode"
import { computeScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import type { StockPriceHistory, Stock } from "@/types/stock"
import { toPriceFilename } from "@/lib/tickerFilename"

const PILLAR_KEYS: Array<keyof ReturnType<typeof computeScore>["pillars"]> = [
  "valorisation", "qualite", "croissance", "sante", "dividende", "momentum", "quant",
]
const PILLAR_LABELS_MAP: Record<string, string> = {
  valorisation: "Valorisation", qualite: "Rentabilité", croissance: "Croissance",
  sante: "Santé", dividende: "Dividende", momentum: "Momentum", quant: "Quant",
}

function SimpleComparePanel({ stocks, allStocks }: { stocks: Stock[]; allStocks: Stock[] }) {
  const scores = stocks.map((s) => computeScore(s, allStocks))

  // Pillar wins per stock
  const wins = scores.map((_, i) => {
    return PILLAR_KEYS.filter((k) => {
      const myVal = scores[i].pillars[k]
      return scores.every((s, j) => j === i || myVal >= s.pillars[k])
    }).length
  })

  const best = wins.indexOf(Math.max(...wins))

  return (
    <div className="space-y-6">
      {/* Score lettre + badges */}
      <div className={cn("grid gap-4", stocks.length === 2 ? "sm:grid-cols-2" : stocks.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
        {stocks.map((stock, i) => {
          const score = scores[i]
          return (
            <Card key={stock.ticker} className={cn(i === best && "ring-2 ring-primary")}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold truncate">{stock.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stock.ticker}</div>
                  </div>
                  {i === best && stocks.length > 1 && (
                    <Badge variant="secondary" className="text-[10px]">Meilleur</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <LetterGrade score={score.total} size="md" />
                  <p className="text-xs text-muted-foreground leading-snug">{score.summary}</p>
                </div>
                {score.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {score.flags.slice(0, 3).map((f) => (
                      <Badge key={f.id} variant="outline" className={cn("text-[10px] h-5 px-1.5", f.color)}>
                        {f.emoji} {f.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Verdict */}
      {stocks.length === 2 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-center">
              <span className="font-semibold">{stocks[best].name}</span> est mieux notée que{" "}
              <span className="font-semibold">{stocks[1 - best].name}</span> sur{" "}
              <span className="font-semibold text-primary">{wins[best]}/{PILLAR_KEYS.length}</span> dimensions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 6 métriques clés */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dimension</th>
              {stocks.map((s) => (
                <th key={s.ticker} className="px-4 py-3 text-right font-mono font-semibold">{s.ticker}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PILLAR_KEYS.map((key) => {
              const vals = scores.map((s) => s.pillars[key])
              const maxVal = Math.max(...vals)
              return (
                <tr key={key} className="border-b last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{PILLAR_LABELS_MAP[key]}</td>
                  {scores.map((score, i) => {
                    const v = score.pillars[key]
                    const isBest = stocks.length > 1 && v === maxVal
                    const dot = v >= 7 ? "bg-emerald-500" : v >= 4.5 ? "bg-yellow-500" : "bg-red-500"
                    return (
                      <td key={stocks[i].ticker} className={cn("px-4 py-2 text-right tabular-nums", isBest && "font-semibold text-emerald-600 dark:text-emerald-400")}>
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn("size-2 rounded-full", dot)} />
                          {v.toFixed(1)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="bg-muted/30">
              <td className="px-4 py-2 font-semibold">Score global</td>
              {scores.map((score, i) => (
                <td key={stocks[i].ticker} className="px-4 py-2 text-right font-bold tabular-nums">
                  {score.total.toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: dataset, loading } = useStocks()
  const { isSimple } = useViewMode()

  const selectedTickers = useMemo(() => {
    const t = searchParams.get("t")
    if (!t) return []
    return t.split(",").filter(Boolean)
  }, [searchParams])

  const setSelectedTickers = useCallback(
    (tickers: string[]) => {
      const params = new URLSearchParams()
      if (tickers.length > 0) params.set("t", tickers.join(","))
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const allStocks = dataset?.stocks ?? []

  const selectedStocks = useMemo(
    () =>
      selectedTickers
        .map((t) => allStocks.find((s) => s.ticker === t))
        .filter((s) => s != null),
    [selectedTickers, allStocks],
  )

  const [priceHistories, setPriceHistories] = useState<
    Array<{ ticker: string; data: StockPriceHistory }>
  >([])

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      if (selectedTickers.length === 0) {
        if (!cancelled) setPriceHistories([])
        return
      }

      const results = await Promise.all(
        selectedTickers.map(async (ticker) => {
          try {
            const r = await fetch(`/data/prices/${toPriceFilename(ticker)}.json`)
            if (!r.ok) return null
            const data = (await r.json()) as StockPriceHistory
            return { ticker, data }
          } catch {
            return null
          }
        }),
      )
      if (!cancelled) setPriceHistories(results.filter((r) => r != null))
    }

    void fetchAll()

    return () => {
      cancelled = true
    }
  }, [selectedTickers])

  if (loading) {
    return <p className="text-muted-foreground">Chargement...</p>
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Comparaison</h1>
        <p className="text-sm text-muted-foreground">
          Sélectionnez jusqu'à 5 actions pour les comparer côte-à-côte
        </p>
      </header>

      <StockSelector
        allStocks={allStocks}
        selected={selectedTickers}
        onChange={setSelectedTickers}
        max={5}
      />

      {selectedStocks.length >= 2 && (
        isSimple ? (
          <SimpleComparePanel stocks={selectedStocks} allStocks={allStocks} />
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Performance normalisée (base 100) — 1 an
                </CardTitle>
              </CardHeader>
              <CardContent>
                {priceHistories.length >= 2 ? (
                  <NormalizedChart histories={priceHistories} />
                ) : (
                  <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                    Chargement des historiques...
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Fondamentaux</h2>
              <CompareTable stocks={selectedStocks} />
            </section>
          </>
        )
      )}

      {selectedStocks.length === 1 && (
        <p className="text-sm text-muted-foreground">
          Ajoutez au moins une deuxième action pour lancer la comparaison.
        </p>
      )}
    </div>
  )
}
