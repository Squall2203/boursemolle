export interface PickPillars {
  valorisation: number
  qualite: number
  croissance: number
  sante: number
  dividende: number
  momentum: number
}

export interface StrategyPick {
  ticker: string
  name: string
  sector: string | null
  country: string
  currency: string
  rank: number
  score: number
  pillars: PickPillars
  weight: number
  isNew: boolean

  pe: number | null
  roe: number | null
  perf6M: number | null
  divYield: number | null
  marketCap: number | null
  price: number | null
  peaEligible: boolean

  justification: string
}

export type StrategyMarket = "FR" | "EU" | "US" | "WORLD"

export interface StrategyResult {
  id: string
  name: string
  emoji: string
  market: StrategyMarket
  marketLabel: string
  description: string
  engine: "rule_based" | "ml"
  benchmarkName: string
  size: number
  picks: StrategyPick[]
  exits: string[]
}

export interface PicksDataset {
  generatedAt: string
  period: string
  nextUpdate: string
  strategies: StrategyResult[]
}
