import { useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { useProfile } from "@/hooks/useProfile"
import { useXP } from "@/contexts/XPContext"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { useStocks } from "@/hooks/useStocks"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { LevelProgress } from "@/components/profile/LevelProgress"
import { BadgeGrid } from "@/components/profile/BadgeGrid"
import { TradingStatsCard } from "@/components/profile/TradingStats"
import { ChallengesCard } from "@/components/profile/ChallengesCard"


export function ProfilePage() {
  const { profile, stats, loading, refetch } = useProfile()
  const { user } = useAuth()
  const { currentXP, earnedBadgeIds, viewedTickerCount, tradeCount } = useXP()
  const { activePortfolio, positions } = usePortfolio()
  const { data: dataset } = useStocks()
  const allStocks = dataset?.stocks ?? []

  const [editingPseudo, setEditingPseudo] = useState(false)
  const [pseudoInput, setPseudoInput] = useState("")
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [savingPseudo, setSavingPseudo] = useState(false)

  const portfolioPerformance = (() => {
    if (!activePortfolio) return null
    const posValue = positions.reduce((sum, pos) => {
      const stock = allStocks.find((s) => s.ticker === pos.ticker)
      return sum + pos.quantity * (stock?.price ?? pos.avg_price)
    }, 0)
    const totalValue = posValue + activePortfolio.cash_balance
    return ((totalValue - activePortfolio.initial_capital) / activePortfolio.initial_capital) * 100
  })()

  async function savePseudo() {
    if (!user) return
    const trimmed = pseudoInput.trim()
    if (!trimmed) { setPseudoError("Le pseudo ne peut pas être vide."); return }
    if (trimmed.length < 3) { setPseudoError("Minimum 3 caractères."); return }
    if (trimmed.length > 20) { setPseudoError("Maximum 20 caractères."); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) { setPseudoError("Lettres, chiffres, _ et - uniquement."); return }

    setSavingPseudo(true)
    const { error } = await supabase.from("users").update({ pseudo: trimmed }).eq("id", user.id)
    setSavingPseudo(false)

    if (error) {
      setPseudoError(error.message.includes("unique") ? "Ce pseudo est déjà pris." : error.message)
      return
    }
    setEditingPseudo(false)
    await refetch()
  }

  const displayXP = currentXP || profile?.xp || 0
  const displayLevel = profile?.level ?? 1

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground">Chargement...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          {profile?.email && (
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          )}
        </div>
      </div>

      {/* Pseudo editing */}
      <div className="rounded-xl border bg-card px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pseudo (affiché dans le classement)
        </p>
        {editingPseudo ? (
          <div className="flex items-center gap-2">
            <input
              className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={pseudoInput}
              onChange={(e) => { setPseudoInput(e.target.value); setPseudoError(null) }}
              onKeyDown={(e) => { if (e.key === "Enter") void savePseudo(); if (e.key === "Escape") setEditingPseudo(false) }}
              placeholder="Votre pseudo"
              maxLength={20}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void savePseudo()}
              disabled={savingPseudo}
              className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditingPseudo(false)}
              className="flex size-9 items-center justify-center rounded-lg border hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">
              {profile?.pseudo ?? <span className="text-muted-foreground italic">Non défini</span>}
            </span>
            <button
              type="button"
              onClick={() => { setPseudoInput(profile?.pseudo ?? ""); setPseudoError(null); setEditingPseudo(true) }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
        {pseudoError && <p className="mt-1 text-xs text-red-500">{pseudoError}</p>}
      </div>

      <LevelProgress xp={displayXP} level={displayLevel} />

      {stats && (
        <TradingStatsCard
          stats={stats}
          portfolioPerformance={portfolioPerformance}
        />
      )}

      <ChallengesCard />

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
