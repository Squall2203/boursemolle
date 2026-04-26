import { useEffect, useState } from "react"
import type { PicksDataset } from "@/types/picks"

interface UsePicksResult {
  data: PicksDataset | null
  loading: boolean
  error: string | null
}

export function usePicks(): UsePicksResult {
  const [data, setData] = useState<PicksDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/data/picks/latest.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: PicksDataset) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
