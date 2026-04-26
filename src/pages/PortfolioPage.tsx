import { useEffect, useMemo, useState } from "react"
import { Globe, GlobeLock, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { useStocks } from "@/hooks/useStocks"
import { computeScore } from "@/lib/scoring"
import { CreatePortfolioCard } from "@/components/portfolio/CreatePortfolioCard"
import { PortfolioStats } from "@/components/portfolio/PortfolioStats"
import { PortfolioChart } from "@/components/portfolio/PortfolioChart"
import { PositionsTable, type EnrichedPosition } from "@/components/portfolio/PositionsTable"
import { PortfolioAnalysis } from "@/components/portfolio/PortfolioAnalysis"
import { TransactionHistory } from "@/components/portfolio/TransactionHistory"
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots"

export function PortfolioPage() {
  const {
    portfolios,
    activePortfolio,
    activePortfolioId,
    setActivePortfolioId,
    positions,
    transactions,
    loading,
    saveSnapshot,
    togglePublic,
    resetPortfolio,
  } = usePortfolio()

  const { data: dataset } = useStocks()
  const allStocks = useMemo(() => dataset?.stocks ?? [], [dataset])

  const { snapshots } = usePortfolioSnapshots(activePortfolioId)

  const [tab, setTab] = useState<"positions" | "history">("positions")
  const [creatingNew, setCreatingNew] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const enrichedPositions = useMemo<EnrichedPosition[]>(() => {
    if (!activePortfolio) return []

    function normalizedPrice(stock: { price?: number | null; currency?: string } | undefined, fallback: number): number {
      if (!stock?.price) return fallback
      return stock.currency === "GBp" ? stock.price / 100 : stock.price
    }

    const totalPositionsValue = positions.reduce((sum, pos) => {
      const stock = allStocks.find((s) => s.ticker === pos.ticker)
      return sum + pos.quantity * normalizedPrice(stock, pos.avg_price)
    }, 0)
    const totalValue = totalPositionsValue + activePortfolio.cash_balance

    return positions.map((pos) => {
      const stock = allStocks.find((s) => s.ticker === pos.ticker)
      const currentPrice = stock ? normalizedPrice(stock, pos.avg_price) : null
      const value = pos.quantity * (currentPrice ?? pos.avg_price)
      const cost = pos.quantity * pos.avg_price
      const pl = value - cost
      const plPercent = cost > 0 ? (pl / cost) * 100 : 0
      const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
      const score = stock ? computeScore(stock, allStocks).total : null

      return { ...pos, stock, currentPrice, value, cost, pl, plPercent, weight, score }
    })
  }, [positions, allStocks, activePortfolio])

  const totalPositionsValue = enrichedPositions.reduce((s, p) => s + p.value, 0)
  const totalValue = activePortfolio
    ? totalPositionsValue + activePortfolio.cash_balance
    : 0

  const avgScore = useMemo(() => {
    const withScore = enrichedPositions.filter((p) => p.score != null && p.value > 0)
    if (withScore.length === 0) return null
    const weighted = withScore.reduce((s, p) => s + p.score! * p.value, 0)
    const totalW = withScore.reduce((s, p) => s + p.value, 0)
    return totalW > 0 ? weighted / totalW : null
  }, [enrichedPositions])

  // Save daily snapshot for leaderboard (fire-and-forget)
  useEffect(() => {
    if (!activePortfolio || totalValue === 0) return
    void saveSnapshot(totalValue, activePortfolio.cash_balance, totalPositionsValue)
  }, [activePortfolio?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground">Chargement...</p>
  }

  if (portfolios.length === 0 || creatingNew) {
    return (
      <CreatePortfolioCard
        onCreated={() => setCreatingNew(false)}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{activePortfolio?.name}</h1>
          {activePortfolio && (
            <p className="text-sm text-muted-foreground">
              Créé le{" "}
              {new Date(activePortfolio.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Portfolio switcher */}
          {portfolios.length > 1 &&
            portfolios.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePortfolioId(p.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  p.id === activePortfolioId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          {activePortfolio && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void togglePublic()}
              title={activePortfolio.is_public ? "Retirer du classement" : "Apparaître dans le classement"}
            >
              {activePortfolio.is_public ? (
                <>
                  <Globe className="mr-1.5 size-3.5 text-emerald-500" />
                  Public
                </>
              ) : (
                <>
                  <GlobeLock className="mr-1.5 size-3.5" />
                  Privé
                </>
              )}
            </Button>
          )}
          {portfolios.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreatingNew(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Nouveau PEA
            </Button>
          )}
          {activePortfolio && !confirmReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReset(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Réinitialiser
            </Button>
          )}
          {confirmReset && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confirmer ?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true)
                  await resetPortfolio()
                  setResetting(false)
                  setConfirmReset(false)
                }}
              >
                {resetting ? "..." : "Oui, réinitialiser"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>
      </div>

      {activePortfolio && (
        <>
          <PortfolioStats
            totalValue={totalValue}
            initialCapital={activePortfolio.initial_capital}
            cashBalance={activePortfolio.cash_balance}
            avgScore={avgScore}
          />

          {/* Performance chart */}
          <Card>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioChart
                snapshots={snapshots}
                initialCapital={activePortfolio.initial_capital}
              />
            </CardContent>
          </Card>

          {/* Positions / History tabs */}
          <div className="flex gap-1 text-sm">
            {(["positions", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t === "positions" ? `Positions (${positions.length})` : "Historique"}
              </button>
            ))}
          </div>

          {tab === "positions" ? (
            <PositionsTable positions={enrichedPositions} />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TransactionHistory transactions={transactions} />
              </CardContent>
            </Card>
          )}

          <PortfolioAnalysis
            positions={enrichedPositions}
            totalValue={totalValue}
            cashBalance={activePortfolio.cash_balance}
          />
        </>
      )}
    </div>
  )
}
