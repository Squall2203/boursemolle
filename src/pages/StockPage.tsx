import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PriceChart } from "@/components/stock/PriceChart"
import { StockHeader } from "@/components/stock/StockHeader"
import { FundamentalsTable } from "@/components/stock/FundamentalsTable"
import { GrowthHistoryTable } from "@/components/stock/GrowthHistoryTable"
import { DividendSparkline } from "@/components/stock/DividendSparkline"
import { TechnicalAnalysisPanel } from "@/components/stock/TechnicalAnalysisPanel"
import { computeScore } from "@/lib/scoring"
import { usePriceHistory } from "@/hooks/usePriceHistory"
import { useStocks } from "@/hooks/useStocks"

export function StockPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const { data: dataset, loading: stocksLoading } = useStocks()
  const { data: priceData, loading: pricesLoading } = usePriceHistory(ticker ?? "")

  if (!ticker) return <p className="text-destructive">Ticker manquant.</p>

  if (stocksLoading) {
    return <p className="text-muted-foreground">Chargement...</p>
  }

  const allStocks = dataset?.stocks ?? []
  const stock = allStocks.find((s) => s.ticker === ticker)
  if (!stock) {
    return (
      <p className="text-destructive">
        Action « {ticker} » introuvable.
      </p>
    )
  }

  const score = computeScore(stock, allStocks)

  return (
    <div className="space-y-8">
      <StockHeader stock={stock} score={score} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Graphique de prix
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pricesLoading ? (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              Chargement du graphique...
            </div>
          ) : priceData && priceData.candles.length > 0 ? (
            <PriceChart
              candles={priceData.candles}
              currency={stock.currency}
            />
          ) : (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              Historique de prix indisponible.
            </div>
          )}
        </CardContent>
      </Card>

      {priceData && priceData.candles.length > 0 && (
        <>
          <Separator />
          <TechnicalAnalysisPanel
            candles={priceData.candles}
            currency={stock.currency}
          />
        </>
      )}

      {(stock.annualFinancials.length >= 2 || stock.dividendHistory.length >= 2) && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Historique financier</h2>
            {stock.annualFinancials.length >= 2 && (
              <GrowthHistoryTable
                financials={stock.annualFinancials}
                currency={stock.currency}
              />
            )}
            {stock.dividendHistory.length >= 2 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Dividende par action — historique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DividendSparkline
                    dividends={stock.dividendHistory}
                    currency={stock.currency}
                  />
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Fondamentaux</h2>
        <FundamentalsTable stock={stock} />
      </section>

      {stock.description && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">À propos</h2>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {stock.description}
                </p>
                {stock.employees && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {stock.employees.toLocaleString("fr-FR")} employés
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
