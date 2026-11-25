import { useEffect, useState } from "react"
import type { BenchmarkPoint } from "@/lib/portfolioReview"

interface BenchmarksFile {
  benchmarks: Record<string, { name: string; points: BenchmarkPoint[] }>
}

/** Historique d'un indice de référence (absent tant que l'ingestion ne l'a pas produit). */
export function useBenchmark(id = "cac40") {
  const [data, setData] = useState<{ name: string; points: BenchmarkPoint[] } | null>(null)

  useEffect(() => {
    fetch("/data/benchmarks.json")
      .then((r) => (r.ok ? (r.json() as Promise<BenchmarksFile>) : null))
      .then((file) => setData(file?.benchmarks?.[id] ?? null))
      .catch(() => setData(null))
  }, [id])

  return data
}
