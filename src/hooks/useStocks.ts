import { useEffect, useState } from "react"
import type { StocksDataset } from "@/types/stock"
import { toEur } from "@/lib/fx"

/** Garantit une capitalisation en euros sur chaque action, quel que soit l'âge du fichier de données. */
function withMarketCapEur(json: StocksDataset): StocksDataset {
  for (const s of json.stocks) {
    if (s.marketCapEur == null) s.marketCapEur = toEur(s.marketCap, s.currency, json.fxRates)
  }
  return json
}

interface UseStocksResult {
  data: StocksDataset | null
  loading: boolean
  error: string | null
  refresh: () => void
}

// Module-level cache: all hook instances share data and refresh together
let _cachedData: StocksDataset | null = null
let _refreshListeners: Array<() => void> = []

export function triggerStocksRefresh() {
  for (const fn of _refreshListeners) fn()
}

export function useStocks(): UseStocksResult {
  const [data, setData] = useState<StocksDataset | null>(() => _cachedData)
  const [loading, setLoading] = useState(() => _cachedData === null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const fn = () => setRefreshKey((k) => k + 1)
    _refreshListeners.push(fn)
    return () => {
      _refreshListeners = _refreshListeners.filter((f) => f !== fn)
    }
  }, [])

  useEffect(() => {
    // Skip initial fetch if cache is already populated (avoids N parallel fetches on mount)
    if (_cachedData && refreshKey === 0) return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    // « no-cache » : le navigateur vérifie si le fichier a changé et ne le retélécharge (3 Mo) que dans ce cas
    fetch("/data/stocks.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<StocksDataset>
      })
      .then((json) => {
        if (cancelled) return
        _cachedData = withMarketCapEur(json)
        setData(_cachedData)
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
  }, [refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  return { data, loading, error, refresh }
}
