import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CompareTable } from "@/components/compare/CompareTable"
import { NormalizedChart } from "@/components/compare/NormalizedChart"
import { StockSelector } from "@/components/compare/StockSelector"
import { useStocks } from "@/hooks/useStocks"
import type { StockPriceHistory } from "@/types/stock"
import { toPriceFilename } from "@/lib/tickerFilename"

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: dataset, loading } = useStocks()

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
    if (selectedTickers.length === 0) {
      setPriceHistories([])
      return
    }

    let cancelled = false

    Promise.all(
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
    ).then((results) => {
      if (cancelled) return
      setPriceHistories(
        results.filter((r) => r != null),
      )
    })

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
      )}

      {selectedStocks.length === 1 && (
        <p className="text-sm text-muted-foreground">
          Ajoutez au moins une deuxième action pour lancer la comparaison.
        </p>
      )}
    </div>
  )
}
