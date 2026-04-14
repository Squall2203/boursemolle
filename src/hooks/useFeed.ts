import { useEffect, useState } from "react"
import type { FeedData, FeedItem } from "@/types/feed"

interface UseFeedResult {
  data: FeedData | null
  loading: boolean
  error: string | null
}

export function useFeed(): UseFeedResult {
  const [data, setData] = useState<FeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const r = await fetch("/data/feed.json")
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json() as FeedData
        if (!cancelled) { setData(json); setLoading(false) }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

interface UseTickerFeedResult {
  items: FeedItem[]
  loading: boolean
}

export function useTickerFeed(ticker: string): UseTickerFeedResult {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const safeName = ticker.replace(/[^a-zA-Z0-9._-]/g, "_")
      try {
        const r = await fetch(`/data/feed/${safeName}.json`)
        const json = r.ok ? await r.json() as FeedData : null
        if (!cancelled) { setItems(json?.items ?? []); setLoading(false) }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [ticker])

  return { items, loading }
}
