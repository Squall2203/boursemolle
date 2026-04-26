import { useEffect, useState } from "react"
import type { PicksHistory } from "@/types/picks"

interface UsePicksHistoryResult {
  data: PicksHistory | null
  loading: boolean
}

export function usePicksHistory(): UsePicksHistoryResult {
  const [data, setData] = useState<PicksHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/data/picks/history.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: PicksHistory) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
