import { useState, useEffect } from "react"

export interface MacroItem {
  value: number
  change: number
  changePercent: number
  label: string
  static?: true
}

export interface MacroData {
  generatedAt: string
  cac40:  MacroItem | null
  sp500:  MacroItem | null
  eurusd: MacroItem | null
  brent:  MacroItem | null
  us10y:  MacroItem | null
  bce:    MacroItem
  eurgbp: MacroItem | null
  eursek: MacroItem | null
}

let _cached: MacroData | null = null

export function useMacro() {
  const [data, setData] = useState<MacroData | null>(_cached)
  const [loading, setLoading] = useState(_cached === null)

  useEffect(() => {
    if (_cached) return
    fetch("/data/macro.json")
      .then((r) => r.json() as Promise<MacroData>)
      .then((d) => { _cached = d; setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { data, loading }
}
