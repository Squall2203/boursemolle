/**
 * AlphaPicks — Monthly scoring pipeline (Phase 0: Rule-Based)
 * Reads public/data/stocks.json → outputs public/data/picks/latest.json
 * Run: npx tsx scripts/alphapicks.ts
 */

import fs from "fs"
import path from "path"

// ─── Types ──────────────────────────────────────────────────────────────────

interface StockData {
  ticker: string
  name: string
  exchange: string
  currency: string
  country: string
  sector: string | null
  industry: string | null
  price: number | null
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  evToEbitda: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
  profitMargins: number | null
  operatingMargins: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  totalDebt: number | null
  totalCash: number | null
  debtToEquity: number | null
  dividendYield: number | null
  payoutRatio: number | null
  rsi14: number | null
  priceVsSma200: number | null
  sma50: number | null
  sma200: number | null
  perf1M: number | null
  perf6M: number | null
  perf1Y: number | null
  annualFinancials: { year: number; revenue: number | null; netIncome: number | null }[]
  dividendHistory: { year: number; total: number }[]
  peaEligible: boolean
  fetchedAt: string
}

interface PickPillars {
  valorisation: number
  qualite: number
  croissance: number
  sante: number
  dividende: number
  momentum: number
}

interface StrategyConfig {
  id: string
  name: string
  emoji: string
  market: "FR" | "EU" | "US" | "WORLD"
  marketLabel: string
  description: string
  benchmarkName: string
  benchmarkTicker: string
  size: number
  filter: (s: StockData) => boolean
  weights: PickPillars
}

interface PickHistoryItem {
  ticker: string
  name: string
  entryPrice: number | null
  exitPrice: number | null
  return: number | null
}

interface StrategyHistoryEntry {
  portfolioReturn: number | null
  picks: PickHistoryItem[]
}

interface PicksHistoryPeriod {
  period: string
  generatedAt: string
  evaluatedAt: string
  strategies: Record<string, StrategyHistoryEntry>
}

interface PicksHistory {
  entries: PicksHistoryPeriod[]
}

// ─── Benchmark fetch ──────────────────────────────────────────────────────────

async function fetchBenchmarkPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!r.ok) return null
    const data = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } }
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

// ─── Chart data helpers ───────────────────────────────────────────────────────

interface ChartPoint { date: string; value: number }

async function fetchBenchmarkHistory(ticker: string): Promise<ChartPoint[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=1y`
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!r.ok) return []
    const data = await r.json() as {
      chart?: {
        result?: {
          timestamp?: number[]
          indicators?: { adjclose?: { adjclose: (number | null)[] }[] }
        }[]
      }
    }
    const result = data?.chart?.result?.[0]
    if (!result?.timestamp) return []
    const timestamps = result.timestamp
    const closes = result.indicators?.adjclose?.[0]?.adjclose ?? []
    const points: ChartPoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i]
      if (close != null) {
        const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
        points.push({ date, value: close })
      }
    }
    if (points.length === 0) return []
    const base = points[0].value
    return points.map(p => ({ date: p.date, value: Math.round((p.value / base) * 10000) / 100 }))
  } catch {
    return []
  }
}

function computePortfolioChart(
  tickers: string[],
  priceDir: string,
): ChartPoint[] {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  // Load & filter candles per ticker
  const pricesByticker: { ticker: string; candles: { date: string; close: number }[] }[] = []
  for (const ticker of tickers) {
    const p = path.join(priceDir, `${ticker}.json`)
    if (!fs.existsSync(p)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"))
      const candles = (raw.candles ?? [])
        .filter((c: { date: string }) => c.date >= cutoffStr)
        .map((c: { date: string; close: number }) => ({ date: c.date, close: c.close }))
      if (candles.length > 0) pricesByticker.push({ ticker, candles })
    } catch { /* skip */ }
  }
  if (pricesByticker.length === 0) return []

  // Collect all dates and group by ISO week → keep last date per week
  const allDates = new Set<string>()
  for (const { candles } of pricesByticker) for (const c of candles) allDates.add(c.date)
  const sortedDates = Array.from(allDates).sort()

  const weekMap = new Map<string, string>()
  for (const date of sortedDates) {
    const d = new Date(date)
    const thu = new Date(d); thu.setDate(d.getDate() + (4 - (d.getDay() || 7)))
    const weekKey = `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, "0")}-${String(thu.getDate()).padStart(2, "0")}`
    weekMap.set(weekKey, date)
  }
  const weeklyDates = Array.from(weekMap.values()).sort()

  // Build price maps and start prices
  const maps = pricesByticker.map(({ candles }) => {
    const m = new Map<string, number>()
    for (const c of candles) m.set(c.date, c.close)
    return m
  })
  const startPrices = maps.map(m => {
    for (const d of sortedDates) { const v = m.get(d); if (v != null) return v }
    return null
  })

  // Compute equal-weighted indexed values
  const lastKnown = startPrices.map(p => p ?? 0)
  const result: ChartPoint[] = []

  for (const date of weeklyDates) {
    const vals: number[] = []
    for (let i = 0; i < maps.length; i++) {
      const sp = startPrices[i]
      if (sp == null || sp === 0) continue
      const price = maps[i].get(date)
      if (price != null) lastKnown[i] = price
      vals.push((lastKnown[i] / sp) * 100)
    }
    if (vals.length > 0) {
      result.push({ date, value: Math.round((vals.reduce((a, b) => a + b) / vals.length) * 100) / 100 })
    }
  }

  return result
}

// ─── Math helpers ────────────────────────────────────────────────────────────

function lerp(v: number, bps: [number, number][]): number {
  if (v <= bps[0][0]) return bps[0][1]
  if (v >= bps[bps.length - 1][0]) return bps[bps.length - 1][1]
  for (let i = 0; i < bps.length - 1; i++) {
    const [x0, y0] = bps[i]
    const [x1, y1] = bps[i + 1]
    if (v >= x0 && v <= x1) return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0)
  }
  return 5
}

function clamp(v: number, lo = 0, hi = 10): number {
  return Math.max(lo, Math.min(hi, v))
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

// ─── Pillar scorers (absolute thresholds — no sector calibration in script) ──

function scoreValo(s: StockData, sectorPeMedian: number | null): number {
  let pts = 0, w = 0

  if (s.trailingPE != null && s.trailingPE > 0 && s.trailingPE < 150) {
    const ref = sectorPeMedian ?? 18
    const ratio = s.trailingPE / ref
    const note = clamp(lerp(ratio, [[0.3, 10], [0.6, 8], [0.8, 6], [1.0, 5], [1.2, 4], [1.5, 2], [2.0, 0]]))
    pts += note * 0.40; w += 0.40
  }
  if (s.evToEbitda != null && s.evToEbitda > 0 && s.evToEbitda < 80) {
    const note = clamp(lerp(s.evToEbitda, [[4, 10], [8, 8], [12, 6], [16, 4], [20, 2], [30, 0]]))
    pts += note * 0.30; w += 0.30
  }
  if (s.priceToBook != null && s.priceToBook > 0) {
    const note = clamp(lerp(s.priceToBook, [[0.5, 10], [1.0, 8], [2.0, 6], [3.0, 4], [5.0, 2], [8.0, 0]]))
    pts += note * 0.20; w += 0.20
  }
  if (s.trailingPE != null && s.trailingPE > 0) {
    const earningsYield = 100 / s.trailingPE
    const note = clamp(lerp(earningsYield, [[0, 0], [2, 2], [4, 5], [6, 7], [8, 9], [12, 10]]))
    pts += note * 0.10; w += 0.10
  }

  return w > 0 ? clamp(pts / w) : 5
}

function scoreQualite(s: StockData): number {
  let pts = 0, w = 0

  if (s.returnOnEquity != null) {
    const note = clamp(lerp(s.returnOnEquity, [[-10, 0], [0, 2], [5, 4], [12, 6], [18, 8], [25, 10]]))
    pts += note * 0.35; w += 0.35
  }
  if (s.returnOnAssets != null) {
    const note = clamp(lerp(s.returnOnAssets, [[0, 0], [2, 3], [5, 5], [8, 7], [12, 10]]))
    pts += note * 0.20; w += 0.20
  }
  if (s.operatingMargins != null) {
    const note = clamp(lerp(s.operatingMargins, [[0, 0], [5, 3], [10, 5], [18, 7], [28, 10]]))
    pts += note * 0.25; w += 0.25
  }
  if (s.profitMargins != null) {
    const note = clamp(lerp(s.profitMargins, [[0, 0], [3, 3], [7, 5], [12, 7], [20, 10]]))
    pts += note * 0.20; w += 0.20
  }

  return w > 0 ? clamp(pts / w) : 5
}

function scoreCroissance(s: StockData): number {
  let pts = 0, w = 0

  if (s.revenueGrowth != null) {
    const note = clamp(lerp(s.revenueGrowth, [[-20, 0], [-5, 2], [0, 3], [5, 6], [10, 8], [20, 10]]))
    pts += note * 0.35; w += 0.35
  }
  if (s.earningsGrowth != null) {
    const eg = Math.min(s.earningsGrowth, 300)
    const note = clamp(lerp(eg, [[-30, 0], [-10, 2], [0, 3], [10, 6], [20, 8], [35, 10]]))
    pts += note * 0.35; w += 0.35
  }
  const fin = s.annualFinancials.slice(-3)
  if (fin.length >= 3) {
    const revs = fin.map(f => f.revenue).filter((r): r is number => r != null)
    if (revs.length >= 3) {
      const upYears = revs.filter((r, i) => i > 0 && r > revs[i - 1]).length
      const note = upYears === 2 ? 10 : upYears === 1 ? 5 : 1
      pts += note * 0.30; w += 0.30
    }
  }

  return w > 0 ? clamp(pts / w) : 5
}

function scoreSante(s: StockData): number {
  let pts = 0, w = 0

  if (s.debtToEquity != null) {
    const note = clamp(lerp(s.debtToEquity, [[0, 10], [30, 8], [60, 6], [100, 5], [150, 3], [250, 1], [400, 0]]))
    pts += note * 0.40; w += 0.40
  }
  if (s.totalDebt != null && s.totalCash != null && s.marketCap != null && s.marketCap > 0) {
    const netDebtRatio = (s.totalDebt - s.totalCash) / s.marketCap
    const note = clamp(lerp(netDebtRatio, [[-0.3, 10], [0, 7], [0.3, 5], [0.6, 3], [1.0, 1], [1.5, 0]]))
    pts += note * 0.35; w += 0.35
  }
  const fin = s.annualFinancials.slice(-3)
  if (fin.length >= 2) {
    const positiveYears = fin.filter(f => f.netIncome != null && f.netIncome > 0).length
    const note = positiveYears === fin.length ? 10 : positiveYears >= 1 ? 5 : 1
    pts += note * 0.25; w += 0.25
  }

  return w > 0 ? clamp(pts / w) : 5
}

function scoreDividende(s: StockData): number {
  if (!s.dividendYield || s.dividendYield === 0) return 0

  let pts = 0, w = 0

  const dy = s.dividendYield
  let noteRendement: number
  if (dy >= 3.5 && dy <= 6.0) noteRendement = 10
  else if ((dy >= 2.5 && dy < 3.5) || (dy > 6.0 && dy <= 7.5)) noteRendement = 7
  else if (dy >= 1.5 && dy < 2.5) noteRendement = 5
  else if (dy > 7.5) noteRendement = 3
  else noteRendement = 2
  pts += noteRendement * 0.30; w += 0.30

  if (s.payoutRatio != null) {
    const pr = s.payoutRatio
    const note = pr >= 25 && pr <= 55 ? 10 : pr <= 70 ? 7 : pr <= 85 ? 4 : 1
    pts += note * 0.30; w += 0.30
  }

  const divHist = s.dividendHistory
  if (divHist.length >= 2) {
    let consecutive = 0
    for (let i = divHist.length - 1; i > 0; i--) {
      if (divHist[i].total >= divHist[i - 1].total) consecutive++
      else break
    }
    const note = consecutive >= 4 ? 10 : consecutive >= 3 ? 8 : consecutive >= 2 ? 6 : consecutive >= 1 ? 4 : 2
    pts += note * 0.25; w += 0.25

    if (divHist.length >= 3) {
      const first = divHist[0].total, last = divHist[divHist.length - 1].total
      if (first > 0 && last > 0) {
        const cagr = (Math.pow(last / first, 1 / (divHist.length - 1)) - 1) * 100
        const note2 = clamp(lerp(cagr, [[-5, 0], [0, 3], [3, 5], [6, 7], [10, 10]]))
        pts += note2 * 0.15; w += 0.15
      }
    }
  }

  const score = w > 0 ? clamp(pts / w) : 5
  // Value trap penalty
  if (dy > 8 && s.payoutRatio != null && s.payoutRatio > 90) return Math.max(0, score - 2)
  return score
}

function scoreMomentum(s: StockData): number {
  let pts = 0, w = 0

  if (s.priceVsSma200 != null) {
    const note = clamp(lerp(s.priceVsSma200, [[-20, 0], [-10, 2], [-3, 4], [0, 5], [5, 7], [15, 10], [25, 10]]))
    pts += note * 0.30; w += 0.30
  }
  if (s.sma50 != null && s.sma200 != null && s.sma200 > 0) {
    const cross = ((s.sma50 - s.sma200) / s.sma200) * 100
    const note = clamp(lerp(cross, [[-10, 0], [-3, 2], [0, 5], [3, 8], [10, 10]]))
    pts += note * 0.20; w += 0.20
  }
  if (s.rsi14 != null) {
    const rsi = s.rsi14
    const note = rsi >= 45 && rsi <= 65 ? 10 : rsi >= 35 && rsi < 45 ? 7 : rsi > 65 && rsi <= 75 ? 6 : rsi < 35 ? 4 : 2
    pts += note * 0.25; w += 0.25
  }
  if (s.perf6M != null) {
    const note = clamp(lerp(s.perf6M, [[-30, 0], [-15, 1], [-5, 3], [0, 5], [5, 7], [15, 9], [30, 10]]))
    pts += note * 0.25; w += 0.25
  }

  return w > 0 ? clamp(pts / w) : 5
}

function computePillars(s: StockData, sectorPeMedian: number | null): PickPillars {
  return {
    valorisation: Math.round(scoreValo(s, sectorPeMedian) * 10) / 10,
    qualite: Math.round(scoreQualite(s) * 10) / 10,
    croissance: Math.round(scoreCroissance(s) * 10) / 10,
    sante: Math.round(scoreSante(s) * 10) / 10,
    dividende: Math.round(scoreDividende(s) * 10) / 10,
    momentum: Math.round(scoreMomentum(s) * 10) / 10,
  }
}

function strategyScore(pillars: PickPillars, weights: PickPillars): number {
  return (
    pillars.valorisation * weights.valorisation +
    pillars.qualite * weights.qualite +
    pillars.croissance * weights.croissance +
    pillars.sante * weights.sante +
    pillars.dividende * weights.dividende +
    pillars.momentum * weights.momentum
  )
}

// ─── Justification generator ─────────────────────────────────────────────────

function generateJustification(s: StockData, pillars: PickPillars, stratId: string): string {
  const parts: string[] = []

  // Lead: strongest pillar
  const sorted = (Object.entries(pillars) as [keyof PickPillars, number][])
    .sort((a, b) => b[1] - a[1])

  const [top] = sorted[0]

  if (top === "valorisation" && pillars.valorisation >= 6) {
    if (s.trailingPE != null && s.trailingPE > 0)
      parts.push(`Valorisation attractive avec un P/E de ${s.trailingPE.toFixed(1)}x, significativement sous la moyenne historique du secteur.`)
    else
      parts.push("Décote de valorisation marquée sur les ratios de bilan, offrant une marge de sécurité intéressante.")
  } else if (top === "qualite" && pillars.qualite >= 6) {
    if (s.returnOnEquity != null)
      parts.push(`Qualité exceptionnelle avec un ROE de ${s.returnOnEquity.toFixed(0)}%, reflet d'un avantage concurrentiel durable sur ses pairs.`)
    else
      parts.push("Profil de rentabilité supérieur à son secteur, avec des marges régulières sur plusieurs exercices.")
  } else if (top === "croissance" && pillars.croissance >= 6) {
    if (s.revenueGrowth != null && s.revenueGrowth > 0)
      parts.push(`Croissance soutenue du chiffre d'affaires (+${s.revenueGrowth.toFixed(0)}% en glissement annuel), avec une trajectoire haussière cohérente.`)
    else
      parts.push("Dynamique de croissance structurelle portée par des marchés finaux en expansion.")
  } else if (top === "sante" && pillars.sante >= 6) {
    parts.push("Bilan solide avec un endettement maîtrisé, offrant une résilience élevée face aux cycles économiques.")
  } else if (top === "dividende" && pillars.dividende >= 6) {
    if (s.dividendYield != null)
      parts.push(`Rendement du dividende de ${s.dividendYield.toFixed(1)}% avec un historique de progression régulière, signal de confiance de la direction.`)
  } else if (top === "momentum" && pillars.momentum >= 6) {
    if (s.perf6M != null && s.perf6M > 0)
      parts.push(`Momentum technique favorable : progression de ${s.perf6M.toFixed(0)}% sur 6 mois, cours au-dessus de la SMA 200.`)
    else
      parts.push("Configuration technique constructive, avec des indicateurs de tendance positifs à moyen terme.")
  } else {
    parts.push("Profil fondamental équilibré positionné favorablement sur l'ensemble des critères de sélection.")
  }

  // Supporting fact 1
  if (s.dividendYield != null && s.dividendYield >= 2.5 && top !== "dividende") {
    parts.push(`Le dividende de ${s.dividendYield.toFixed(1)}% renforce le rendement total pour les investisseurs long terme.`)
  } else if (s.returnOnEquity != null && s.returnOnEquity >= 15 && top !== "qualite") {
    parts.push(`Le ROE de ${s.returnOnEquity.toFixed(0)}% confirme la capacité à générer de la valeur actionnariale de façon pérenne.`)
  } else if (s.perf6M != null && s.perf6M > 8 && top !== "momentum") {
    parts.push(`La dynamique de marché est positive avec +${s.perf6M.toFixed(0)}% sur les 6 derniers mois.`)
  } else if (s.revenueGrowth != null && s.revenueGrowth > 5 && top !== "croissance") {
    parts.push(`La croissance du CA de ${s.revenueGrowth.toFixed(0)}% témoigne d'une dynamique commerciale solide.`)
  }

  // Supporting fact 2 — context on selection
  if (stratId === "value-pea")
    parts.push("Éligible PEA, permettant une détention dans une enveloppe fiscalement avantageuse.")
  else if (stratId === "dividendes-croissants" && s.payoutRatio != null && s.payoutRatio < 70)
    parts.push(`Le payout ratio de ${s.payoutRatio.toFixed(0)}% laisse une marge suffisante pour maintenir et accroître le dividende.`)

  return parts.slice(0, 2).join(" ")
}

// ─── Strategy definitions ────────────────────────────────────────────────────

const EU_COUNTRIES = new Set([
  "France", "Germany", "Netherlands", "Belgium", "Spain", "Italy",
  "Switzerland", "Sweden", "Denmark", "Norway", "Finland", "Austria",
  "Portugal", "Ireland", "Luxembourg",
])

const STRATEGIES: StrategyConfig[] = [
  {
    id: "france-elite",
    name: "Champions France",
    emoji: "🇫🇷",
    market: "FR",
    marketLabel: "France · PEA",
    description: "Les meilleures actions françaises cotées sur Euronext Paris, sélectionnées sur la qualité, la valorisation et la solidité financière",
    benchmarkName: "CAC 40",
    benchmarkTicker: "^FCHI",
    size: 10,
    filter: (s) => s.country === "France" && s.peaEligible === true && s.price != null && s.marketCap != null && s.marketCap > 300e6,
    weights: { qualite: 0.30, valorisation: 0.30, sante: 0.20, croissance: 0.10, dividende: 0.10, momentum: 0 },
  },
  {
    id: "value-pea",
    name: "Value PEA",
    emoji: "💎",
    market: "EU",
    marketLabel: "Europe · PEA",
    description: "Actions sous-évaluées PEA-éligibles de la zone euro, sélectionnées sur la valorisation et la solidité financière",
    benchmarkName: "CAC 40",
    benchmarkTicker: "^FCHI",
    size: 10,
    filter: (s) => s.peaEligible === true && s.price != null && s.marketCap != null && s.marketCap > 500e6,
    weights: { valorisation: 0.38, qualite: 0.22, sante: 0.20, dividende: 0.10, croissance: 0.05, momentum: 0.05 },
  },
  {
    id: "qualite-monde",
    name: "Qualité Mondiale",
    emoji: "🌍",
    market: "WORLD",
    marketLabel: "Monde entier",
    description: "Champions de la rentabilité et de la création de valeur, sans frontières géographiques",
    benchmarkName: "MSCI World",
    benchmarkTicker: "CW8.PA",
    size: 12,
    filter: (s) => s.price != null && s.marketCap != null && s.marketCap > 5e9,
    weights: { qualite: 0.38, croissance: 0.25, sante: 0.17, momentum: 0.10, valorisation: 0.10, dividende: 0 },
  },
  {
    id: "dividendes-croissants",
    name: "Dividendes Croissants",
    emoji: "📈",
    market: "EU",
    marketLabel: "Europe",
    description: "Rendement élevé et historique de progression régulière du dividende, bilans solides",
    benchmarkName: "Euro Stoxx 50",
    benchmarkTicker: "^STOXX50E",
    size: 10,
    filter: (s) => (s.dividendYield ?? 0) >= 2.5 && s.price != null && s.marketCap != null && s.marketCap > 1e9,
    weights: { dividende: 0.40, sante: 0.25, qualite: 0.20, valorisation: 0.15, croissance: 0, momentum: 0 },
  },
  {
    id: "momentum-europe",
    name: "Momentum Europe",
    emoji: "⚡",
    market: "EU",
    marketLabel: "Europe",
    description: "Tendances haussières solides sur les marchés européens, confirmées par les fondamentaux",
    benchmarkName: "Euro Stoxx 50",
    benchmarkTicker: "^STOXX50E",
    size: 10,
    filter: (s) => EU_COUNTRIES.has(s.country) && s.price != null && s.marketCap != null && s.marketCap > 2e9,
    weights: { momentum: 0.45, qualite: 0.25, valorisation: 0.15, croissance: 0.15, sante: 0, dividende: 0 },
  },
  {
    id: "pepites-midcap",
    name: "Pépites Mid Cap",
    emoji: "🔍",
    market: "EU",
    marketLabel: "Europe · Mid Cap",
    description: "Petites et moyennes capitalisations européennes sous-valorisées avec un potentiel de croissance élevé",
    benchmarkName: "MSCI Eur. Small Cap",
    benchmarkTicker: "IQQM.DE",
    size: 10,
    filter: (s) =>
      EU_COUNTRIES.has(s.country) &&
      s.price != null &&
      s.marketCap != null &&
      s.marketCap > 300e6 &&
      s.marketCap < 15e9,
    weights: { valorisation: 0.35, croissance: 0.30, qualite: 0.20, sante: 0.15, dividende: 0, momentum: 0 },
  },
]

// ─── Next update date ────────────────────────────────────────────────────────

function nextFirstOfMonth(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toISOString().split("T")[0]
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const stocksPath = path.join(process.cwd(), "public", "data", "stocks.json")
  const outDir = path.join(process.cwd(), "public", "data", "picks")
  const outPath = path.join(outDir, "latest.json")

  if (!fs.existsSync(stocksPath)) {
    console.error("❌ public/data/stocks.json introuvable — lance d'abord l'ingest")
    process.exit(1)
  }

  const dataset = JSON.parse(fs.readFileSync(stocksPath, "utf8"))
  const allStocks: StockData[] = dataset.stocks

  console.log(`📊 Univers : ${allStocks.length} actions`)

  // Previous picks for entry/exit detection + performance tracking
  let previousPicks: Record<string, string[]> = {}
  let previousDataset: { period: string; generatedAt: string; strategies: { id: string; benchmarkPrice?: number | null; picks: { ticker: string; name: string; price: number | null }[] }[] } | null = null

  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8"))
      previousDataset = prev
      for (const s of prev.strategies ?? []) {
        previousPicks[s.id] = (s.picks ?? []).map((p: { ticker: string }) => p.ticker)
      }
    } catch { /* ignore */ }
  }

  // Performance computation — runs when a new month starts
  const period = currentPeriod()
  if (previousDataset && previousDataset.period && previousDataset.period !== period) {
    console.log(`\n📈 Calcul des performances pour la période ${previousDataset.period}...`)

    const priceMap = new Map<string, number>()
    for (const s of allStocks) {
      if (s.price != null) priceMap.set(s.ticker, s.price)
    }

    const strategyResults: Record<string, StrategyHistoryEntry> = {}
    for (const prevStrat of previousDataset.strategies) {
      const picks: PickHistoryItem[] = []
      let totalReturn = 0
      let count = 0

      for (const pick of prevStrat.picks) {
        const exitPrice = priceMap.get(pick.ticker) ?? null
        const ret =
          exitPrice != null && pick.price != null
            ? Math.round(((exitPrice - pick.price) / pick.price) * 10000) / 100
            : null
        picks.push({ ticker: pick.ticker, name: pick.name, entryPrice: pick.price, exitPrice, return: ret })
        if (ret != null) { totalReturn += ret; count++ }
      }

      strategyResults[prevStrat.id] = {
        portfolioReturn: count > 0 ? Math.round((totalReturn / count) * 100) / 100 : null,
        picks,
      }
    }

    const histPath = path.join(outDir, "history.json")
    let history: PicksHistory = { entries: [] }
    if (fs.existsSync(histPath)) {
      try { history = JSON.parse(fs.readFileSync(histPath, "utf8")) } catch { /* ignore */ }
    }

    // Fetch current benchmark prices for return computation
    const benchmarkTickerMap = new Map<string, string>()
    for (const strat of STRATEGIES) {
      benchmarkTickerMap.set(strat.id, strat.benchmarkTicker)
    }

    for (const [id, entry] of Object.entries(strategyResults)) {
      const bmTicker = benchmarkTickerMap.get(id)
      if (!bmTicker) continue

      const prevStrat = previousDataset.strategies.find((s) => s.id === id)
      const bmEntryPrice = prevStrat?.benchmarkPrice ?? null
      const bmExitPrice = await fetchBenchmarkPrice(bmTicker)

      const bmReturn =
        bmEntryPrice != null && bmExitPrice != null
          ? Math.round(((bmExitPrice - bmEntryPrice) / bmEntryPrice) * 10000) / 100
          : null
      const alpha =
        entry.portfolioReturn != null && bmReturn != null
          ? Math.round((entry.portfolioReturn - bmReturn) * 100) / 100
          : null

      entry.benchmarkReturn = bmReturn
      entry.alpha = alpha

      if (bmReturn != null) {
        const sign = bmReturn >= 0 ? "+" : ""
        console.log(`  ${id} benchmark: ${sign}${bmReturn.toFixed(2)}% | alpha: ${alpha != null ? (alpha >= 0 ? "+" : "") + alpha.toFixed(2) + "%" : "n/a"}`)
      }
    }

    history.entries = history.entries.filter((e) => e.period !== previousDataset!.period)
    history.entries.unshift({
      period: previousDataset.period,
      generatedAt: previousDataset.generatedAt,
      evaluatedAt: new Date().toISOString(),
      strategies: strategyResults,
    })

    fs.writeFileSync(histPath, JSON.stringify(history, null, 2))
    console.log("  ✅ history.json mis à jour")
    for (const [id, data] of Object.entries(strategyResults)) {
      if (data.portfolioReturn != null) {
        const sign = data.portfolioReturn >= 0 ? "+" : ""
        console.log(`  ${id}: ${sign}${data.portfolioReturn.toFixed(2)}%`)
      }
    }
  }

  // Sector PE medians for valuation calibration
  const sectorPeMap = new Map<string, number[]>()
  for (const s of allStocks) {
    if (s.trailingPE != null && s.trailingPE > 0 && s.trailingPE < 100 && s.sector) {
      if (!sectorPeMap.has(s.sector)) sectorPeMap.set(s.sector, [])
      sectorPeMap.get(s.sector)!.push(s.trailingPE)
    }
  }
  const sectorPeMedians = new Map<string, number>()
  for (const [sector, pes] of sectorPeMap) {
    const m = median(pes)
    if (m != null) sectorPeMedians.set(sector, m)
  }

  const results = []

  for (const strat of STRATEGIES) {
    const candidates = allStocks.filter(strat.filter)
    console.log(`\n🎯 ${strat.name} — ${candidates.length} candidats`)

    const scored = candidates.map((s) => {
      const sectorPeMedian = s.sector ? (sectorPeMedians.get(s.sector) ?? null) : null
      const pillars = computePillars(s, sectorPeMedian)
      const score = Math.round(strategyScore(pillars, strat.weights) * 10) / 10
      return { s, pillars, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const topN = scored.slice(0, strat.size)

    const prevTickers = previousPicks[strat.id] ?? []
    const currentTickers = topN.map(({ s }) => s.ticker)
    const exits = prevTickers.filter((t) => !currentTickers.includes(t))

    const weight = Math.round((1 / topN.length) * 1000) / 1000

    const picks = topN.map(({ s, pillars, score }, i) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      country: s.country,
      currency: s.currency,
      rank: i + 1,
      score,
      pillars,
      weight,
      isNew: !prevTickers.includes(s.ticker) && prevTickers.length > 0,
      pe: s.trailingPE,
      roe: s.returnOnEquity,
      perf6M: s.perf6M,
      divYield: s.dividendYield,
      marketCap: s.marketCap,
      price: s.price,
      peaEligible: s.peaEligible,
      justification: generateJustification(s, pillars, strat.id),
    }))

    console.log(`  Top 3: ${picks.slice(0, 3).map(p => `${p.ticker} (${p.score.toFixed(1)})`).join(", ")}`)

    const benchmarkPrice = await fetchBenchmarkPrice(strat.benchmarkTicker)
    if (benchmarkPrice != null) {
      console.log(`  Benchmark ${strat.benchmarkTicker}: ${benchmarkPrice.toFixed(2)}`)
    }

    const priceDir = path.join(process.cwd(), "public", "data", "prices")
    const portfolioChart = computePortfolioChart(picks.map(p => p.ticker), priceDir)
    const benchmarkChart = await fetchBenchmarkHistory(strat.benchmarkTicker)
    console.log(`  Chart: ${portfolioChart.length} pts portefeuille, ${benchmarkChart.length} pts benchmark`)

    results.push({
      id: strat.id,
      name: strat.name,
      emoji: strat.emoji,
      market: strat.market,
      marketLabel: strat.marketLabel,
      description: strat.description,
      engine: "rule_based" as const,
      benchmarkName: strat.benchmarkName,
      benchmarkTicker: strat.benchmarkTicker,
      benchmarkPrice,
      size: strat.size,
      picks,
      exits,
      chartData: { portfolio: portfolioChart, benchmark: benchmarkChart },
    })
  }

  // ─── US ML strategy — merge predictions from Python pipeline ──────────────
  const usPredPath = path.join(outDir, "us_predictions.json")
  if (fs.existsSync(usPredPath)) {
    try {
      const usPred = JSON.parse(fs.readFileSync(usPredPath, "utf8"))
      const mlPicks = (usPred.picks ?? []) as Array<{
        ticker: string; name: string; sector: string | null; country: string
        currency: string; rank: number; score: number; pillars: PickPillars
        weight: number; isNew: boolean; pe: number | null; roe: number | null
        perf6M: number | null; divYield: number | null; marketCap: number | null
        price: number | null; peaEligible: boolean; justification: string
      }>

      if (mlPicks.length > 0) {
        // isNew detection vs previous US ML picks
        const prevUsTickers = (previousPicks["tech-us-ml"] ?? [])
        const mlPicksWithNew = mlPicks.map(p => ({
          ...p,
          isNew: !prevUsTickers.includes(p.ticker) && prevUsTickers.length > 0,
        }))
        const mlExits = prevUsTickers.filter(t => !mlPicks.map(p => p.ticker).includes(t))

        const mlBenchmarkTicker = "^GSPC"
        const mlBenchmarkPrice = await fetchBenchmarkPrice(mlBenchmarkTicker)
        const priceDir = path.join(process.cwd(), "public", "data", "prices")
        const mlPortfolioChart = computePortfolioChart(mlPicksWithNew.map(p => p.ticker), priceDir)
        const mlBenchmarkChart = await fetchBenchmarkHistory(mlBenchmarkTicker)

        console.log(`\n🤖 US ML Strategy — ${mlPicksWithNew.length} picks (LightGBM v${usPred.engine ?? "1"})`)
        console.log(`  Top 3: ${mlPicksWithNew.slice(0, 3).map(p => `${p.ticker} (${p.score.toFixed(1)})`).join(", ")}`)

        results.push({
          id: "tech-us-ml",
          name: "US Growth ML",
          emoji: "🤖",
          market: "US" as const,
          marketLabel: "États-Unis",
          description: "Sélection algorithmique LightGBM entraîné sur données SEC EDGAR (PIT) · Univers NYSE + NASDAQ large/mid cap",
          engine: "ml" as const,
          benchmarkName: "S&P 500",
          benchmarkTicker: mlBenchmarkTicker,
          benchmarkPrice: mlBenchmarkPrice,
          size: mlPicksWithNew.length,
          picks: mlPicksWithNew,
          exits: mlExits,
          chartData: { portfolio: mlPortfolioChart, benchmark: mlBenchmarkChart },
        })
      }
    } catch (e) {
      console.warn(`  ⚠️  us_predictions.json invalide: ${e}`)
    }
  } else {
    console.log(`\n🤖 US ML Strategy — pas de prédictions (lancer scripts/ml/pipeline.py --predict)`)
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const output = {
    generatedAt: new Date().toISOString(),
    period,
    nextUpdate: nextFirstOfMonth(),
    strategies: results,
  }

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ ${outPath}`)
  console.log(`   ${results.length} stratégies · ${results.reduce((s, r) => s + r.picks.length, 0)} sélections au total`)
}

main().catch((e) => { console.error(e); process.exit(1) })
