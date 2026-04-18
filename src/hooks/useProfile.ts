import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export interface DbUser {
  id: string
  email: string
  pseudo: string | null
  avatar_url: string | null
  level: number
  xp: number
  created_at: string
  last_seen_at: string | null
}

export interface TradingStats {
  totalTrades: number
  totalBuys: number
  totalSells: number
  portfolioCount: number
  daysSinceFirst: number | null
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<DbUser | null>(null)
  const [stats, setStats] = useState<TradingStats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user) { setLoading(false); return }
    setLoading(true)

    const { data: profileData } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileData) setProfile(profileData)

    // Trading stats
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id, created_at")
      .eq("user_id", user.id)

    const portfolioIds = portfolios?.map((p: { id: number }) => p.id) ?? []

    if (portfolioIds.length > 0) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("type, executed_at")
        .in("portfolio_id", portfolioIds)
        .order("executed_at", { ascending: true })

      const transactions = txData ?? []
      const firstTx = transactions[0]
      const daysSinceFirst = firstTx
        ? Math.floor(
            (Date.now() - new Date(firstTx.executed_at).getTime()) / (1000 * 60 * 60 * 24),
          )
        : null

      setStats({
        totalTrades: transactions.length,
        totalBuys: transactions.filter((t: { type: string }) => t.type === "buy").length,
        totalSells: transactions.filter((t: { type: string }) => t.type === "sell").length,
        portfolioCount: portfolioIds.length,
        daysSinceFirst,
      })
    } else {
      setStats({
        totalTrades: 0,
        totalBuys: 0,
        totalSells: 0,
        portfolioCount: 0,
        daysSinceFirst: null,
      })
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { profile, stats, loading, refetch: load }
}
