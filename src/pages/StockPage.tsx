import { useMemo, useEffect } from "react"
import { TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PriceChart } from "@/components/stock/PriceChart"
import { StockHeader, SimpleFundamentalsCard } from "@/components/stock/StockHeader"
import { FundamentalsTable } from "@/components/stock/FundamentalsTable"
import { GrowthHistoryTable } from "@/components/stock/GrowthHistoryTable"
import { DividendSparkline } from "@/components/stock/DividendSparkline"
import { TechnicalAnalysisPanel } from "@/components/stock/TechnicalAnalysisPanel"
import { analyzeTechnicals } from "@/lib/technicalAnalysis"
import { ExpertsSection } from "@/components/stock/ExpertsSection"
import { StockNewsCard } from "@/components/stock/StockNewsCard"
import { FreshnessBadge } from "@/components/FreshnessBadge"
import { cn } from "@/lib/utils"
import { computeScore } from "@/lib/scoring"
import { usePriceHistory } from "@/hooks/usePriceHistory"
import { useStocks } from "@/hooks/useStocks"
import { useViewMode } from "@/hooks/useViewMode"
import { useAuth } from "@/contexts/AuthContext"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { useXP } from "@/contexts/XPContext"
import { XP_ACTIONS } from "@/lib/xp"

export function StockPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const { data: dataset, loading: stocksLoading } = useStocks()
  const { data: priceData, loading: pricesLoading } = usePriceHistory(ticker ?? "")
  const { isSimple, setMode } = useViewMode()
  const { user, openAuthModal } = useAuth()
  const { openTradeModal } = usePortfolio()
  const { trackStockView, awardXP } = useXP()

  const allStocks = useMemo(() => dataset?.stocks ?? [], [dataset])
  const stock = allStocks.find((s) => s.ticker === ticker)

  // Track view + XP (once per ticker per mount, only when stock is loaded)
  useEffect(() => {
    if (!user || !ticker || !stock) return
    trackStockView(ticker)
    if (!isSimple) {
      const a = XP_ACTIONS.VIEW_STOCK_EXPERT
      awardXP(a.action, a.xp, a.dailyMax)
    }
  }, [user?.id, ticker, !!stock]) // eslint-disable-line react-hooks/exhaustive-deps
  const score = useMemo(
    () => (stock ? computeScore(stock, allStocks) : null),
    [stock, allStocks],
  )

  const technicals = useMemo(() => {
    if (!priceData || priceData.candles.length < 50) return null
    return analyzeTechnicals(priceData.candles)
  }, [priceData])

  if (!ticker) return <p className="text-destructive">Ticker manquant.</p>
  if (stocksLoading) return <p className="text-muted-foreground">Chargement...</p>
  if (!stock || !score) {
    return (
      <p className="text-destructive">
        Action « {ticker} » introuvable.
      </p>
    )
  }

  function handleInvest() {
    if (!user) return openAuthModal()
    if (stock) openTradeModal(stock)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <StockHeader stock={stock} score={score} />
          <FreshnessBadge date={stock.lastFundamentalsUpdate ?? stock.fetchedAt} className="mt-1" />
        </div>
        <Button onClick={handleInvest} className="shrink-0 gap-2">
          <BarChart2 className="size-4" />
          Investir — Paper PEA
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Graphique de prix{isSimple && " — 1 an"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pricesLoading ? (
            <div className={cn("flex items-center justify-center text-muted-foreground", isSimple ? "h-[200px]" : "h-[400px]")}>
              Chargement du graphique...
            </div>
          ) : priceData && priceData.candles.length > 0 ? (
            <PriceChart
              candles={priceData.candles}
              currency={stock.currency}
              simple={isSimple}
            />
          ) : (
            <div className={cn("flex items-center justify-center text-muted-foreground", isSimple ? "h-[200px]" : "h-[400px]")}>
              Historique de prix indisponible.
            </div>
          )}
        </CardContent>
      </Card>

      {isSimple ? (
        <>
          {technicals && (
            <>
              <Separator />
              <Card>
                <CardContent className="flex items-center gap-6 pt-4 pb-4">
                  <div className={cn("flex size-12 items-center justify-center rounded-full bg-muted", technicals.signalColor)}>
                    {technicals.signal === "Haussier" ? (
                      <TrendingUp className="size-5" />
                    ) : technicals.signal === "Baissier" ? (
                      <TrendingDown className="size-5" />
                    ) : (
                      <Minus className="size-5" />
                    )}
                  </div>
                  <div>
                    <div className={cn("text-base font-semibold", technicals.signalColor)}>
                      Signal {technicals.signal}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Confiance : <span className="font-semibold text-foreground">{technicals.confidence}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          <Separator />
          <SimpleFundamentalsCard score={score} onSwitchExpert={() => setMode("expert")} />
        </>
      ) : (
        <>
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
        </>
      )}

      <Separator />
      <ExpertsSection ticker={stock.ticker} simple={isSimple} />

      <StockNewsCard ticker={stock.ticker} />

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
