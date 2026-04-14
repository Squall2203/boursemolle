import { useEffect, useState } from "react"
import type { StockPriceHistory } from "@/types/stock"
import { toPriceFilename } from "@/lib/tickerFilename"

interface UsePriceHistoryResult {
  data: StockPriceHistory | null
  loading: boolean
  error: string | null
}

export function usePriceHistory(ticker: string): UsePriceHistoryResult {
  const [data, setData] = useState<StockPriceHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/data/prices/${toPriceFilename(ticker)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<StockPriceHistory>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ticker])

  return { data, loading, error }
}
