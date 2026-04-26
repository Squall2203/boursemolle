import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface PortfolioSnapshot {
  snapshot_date: string
  total_value: number
  cumulative_return: number | null
}

export function usePortfolioSnapshots(portfolioId: number | null) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!portfolioId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshots([])
      return
    }
    let cancelled = false
    setLoading(true)

    supabase
      .from("portfolio_snapshots")
      .select("snapshot_date, total_value, cumulative_return")
      .eq("portfolio_id", portfolioId)
      .order("snapshot_date", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setSnapshots((data as PortfolioSnapshot[]) ?? [])
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [portfolioId])

  return { snapshots, loading }
}
