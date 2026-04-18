import { useProfile } from "@/hooks/useProfile"
import { useXP } from "@/contexts/XPContext"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { useStocks } from "@/hooks/useStocks"
import { LevelProgress } from "@/components/profile/LevelProgress"
import { BadgeGrid } from "@/components/profile/BadgeGrid"
import { TradingStatsCard } from "@/components/profile/TradingStats"


export function ProfilePage() {
  const { profile, stats, loading } = useProfile()
  const { currentXP, earnedBadgeIds, viewedTickerCount, tradeCount } = useXP()
  const { activePortfolio, positions } = usePortfolio()
  const { data: dataset } = useStocks()
  const allStocks = dataset?.stocks ?? []

  const portfolioPerformance = (() => {
    if (!activePortfolio) return null
    const posValue = positions.reduce((sum, pos) => {
      const stock = allStocks.find((s) => s.ticker === pos.ticker)
      return sum + pos.quantity * (stock?.price ?? pos.avg_price)
    }, 0)
    const totalValue = posValue + activePortfolio.cash_balance
    return ((totalValue - activePortfolio.initial_capital) / activePortfolio.initial_capital) * 100
  })()

  const displayXP = currentXP || profile?.xp || 0
  const displayLevel = profile?.level ?? 1

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground">Chargement...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        {profile?.email && (
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        )}
      </div>

      <LevelProgress xp={displayXP} level={displayLevel} />

      {stats && (
        <TradingStatsCard
          stats={stats}
          portfolioPerformance={portfolioPerformance}
        />
      )}

      <div className="rounded-xl border bg-card px-5 py-4">
        <h3 className="mb-4 text-sm font-semibold">Badges</h3>
        <BadgeGrid
          earnedIds={earnedBadgeIds}
          progressData={{ viewedStockCount: viewedTickerCount, tradeCount }}
        />
      </div>
    </div>
  )
}
