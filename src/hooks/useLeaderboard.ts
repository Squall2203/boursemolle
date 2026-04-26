import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface LeaderboardEntry {
  user_id: string
  pseudo: string
  avatar_url: string | null
  portfolio_id: number
  portfolio_name: string
  total_value: number
  initial_capital: number
  performance: number
  snapshot_date: string
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    supabase
      .rpc("get_leaderboard")
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        if (rpcError) {
          setError(rpcError.message)
        } else {
          setEntries((data as LeaderboardEntry[]) ?? [])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { entries, loading, error }
}
