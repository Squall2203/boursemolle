import { useEffect, useState } from "react"
import type { TickerNews } from "@/types/news"

interface UseStockNewsResult {
  data: TickerNews | null
  loading: boolean
}

export function useStockNews(ticker: string): UseStockNewsResult {
  const [data, setData] = useState<TickerNews | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setData(null)

    const safe = ticker.replace(/[^a-zA-Z0-9._-]/g, "_")
    fetch(`/data/news/${safe}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<TickerNews>
      })
      .then((json) => {
        if (!cancelled) { setData(json); setLoading(false) }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [ticker])

  return { data, loading }
}
