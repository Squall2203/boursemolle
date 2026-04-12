import { useEffect, useState } from "react"
import type { StocksDataset } from "@/types/stock"

interface UseStocksResult {
  data: StocksDataset | null
  loading: boolean
  error: string | null
}

export function useStocks(): UseStocksResult {
  const [data, setData] = useState<StocksDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/data/stocks.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<StocksDataset>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
