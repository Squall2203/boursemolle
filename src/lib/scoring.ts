import type { Stock } from "@/types/stock"
import { getStockRegion, type StockRegion } from "@/lib/market"

// ─── Types ───

export type ScoreLabel = "Achat fort" | "Achat" | "Neutre" | "Sous-performer" | "Éviter"

export type FlagId =
  | "dividend_aristocrat"
  | "value_trap"
  | "turnaround"
  | "cash_machine"
  | "oversold"
  | "overbought"
  | "golden_cross"
  | "death_cross"
  | "consensus_up"
  | "fragile_balance"

export type FlagType = "positive" | "negative"

export interface StockFlag {
  id: FlagId
  type: FlagType
  label: string
  emoji: string
  color: string
  detail: string
  priority: number // 0 = most urgent
}

export interface MetricDetail {
  value: number | null
  displayValue: string
  note: number
  label: string
  weight: number
  sectorMedian: number | null
  ratioVsSector: number | null
  sectorPercentile: number | null
  excluded: boolean
  excludedReason: string | null
}

export interface PillarDetail {
  [metricKey: string]: MetricDetail
}

export interface SectorContext {
  name: string
  count: number
  isSmall: boolean // < 5 stocks
}

export interface StockScore {
  total: number
  label: ScoreLabel
  labelColor: string
  pillars: {
    valorisation: number
    qualite: number
    croissance: number
    sante: number
    dividende: number
    momentum: number
    quant: number
  }
  details: {
    valorisation: PillarDetail
    qualite: PillarDetail
    croissance: PillarDetail
    sante: PillarDetail
    dividende: PillarDetail
    momentum: PillarDetail
    quant: PillarDetail
  }
  sectorContext: SectorContext
  flags: StockFlag[]
  summary: string
}

// ─── Helpers ───

function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v))
}

function lerp(value: number, breakpoints: [number, number][]): number {
  if (value <= breakpoints[0][0]) return breakpoints[0][1]
  if (value >= breakpoints[breakpoints.length - 1][0]) return breakpoints[breakpoints.length - 1][1]
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [t0, s0] = breakpoints[i]
    const [t1, s1] = breakpoints[i + 1]
    if (value >= t0 && value <= t1) {
      const ratio = (value - t0) / (t1 - t0)
      return s0 + ratio * (s1 - s0)
    }
  }
  return 5
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function computePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50
  let below = 0
  for (const v of values) {
    if (v < value) below++
  }
  return Math.round((below / values.length) * 100)
}


function fmt(v: number | null, suffix = ""): string {
  if (v == null) return "—"
  return v.toFixed(1) + suffix
}

function fmtPct(v: number | null): string {
  if (v == null) return "—"
  return v.toFixed(1) + "%"
}



// ─── V3 ratio-based scoring grille ───
// ratio < 0.5 → 10, 0.5-0.7 → 8, 0.7-0.9 → 6, 0.9-1.1 → 5, 1.1-1.3 → 4, 1.3-1.5 → 2, > 1.5 → 0
const RATIO_GRILLE: [number, number][] = [
  [0.3, 10], [0.5, 10], [0.7, 8], [0.9, 6], [1.0, 5], [1.1, 5], [1.3, 4], [1.5, 2], [2.0, 0],
]

// For "higher is better" metrics (ROE, margins): invert the ratio
// ratio > 1.5 → 10, 1.3-1.5 → 8, 1.1-1.3 → 6, 0.9-1.1 → 5, 0.7-0.9 → 4, 0.5-0.7 → 2, < 0.5 → 0
const RATIO_GRILLE_INVERTED: [number, number][] = [
  [0.3, 0], [0.5, 0], [0.7, 2], [0.9, 4], [1.0, 5], [1.1, 5], [1.3, 6], [1.5, 8], [2.0, 10],
]

function scoreByRatio(value: number | null, sectorMedian: number | null, inverted = false): number {
  if (value == null || sectorMedian == null || sectorMedian === 0) return 5
  const ratio = value / sectorMedian
  return clamp(lerp(ratio, inverted ? RATIO_GRILLE_INVERTED : RATIO_GRILLE))
}

// ─── Sector stats ───

interface SectorStats {
  pe: number[]
  evEbitda: number[]
  pb: number[]
  roe: number[]
  roa: number[]
  marginOpe: number[]
  marginNette: number[]
  count: number
}

function computeAllSectorStats(universe: Stock[]): Map<string, SectorStats> {
  const bySector = new Map<string, SectorStats>()

  for (const s of universe) {
    const sector = s.sector ?? "Unknown"
    let stats = bySector.get(sector)
    if (!stats) {
      stats = { pe: [], evEbitda: [], pb: [], roe: [], roa: [], marginOpe: [], marginNette: [], count: 0 }
      bySector.set(sector, stats)
    }
    stats.count++
    if (s.trailingPE != null && s.trailingPE > 0) stats.pe.push(s.trailingPE)
    if (s.evToEbitda != null && s.evToEbitda > 0) stats.evEbitda.push(s.evToEbitda)
    if (s.priceToBook != null && s.priceToBook > 0) stats.pb.push(s.priceToBook)
    if (s.returnOnEquity != null) stats.roe.push(s.returnOnEquity)
    if (s.returnOnAssets != null) stats.roa.push(s.returnOnAssets)
    if (s.operatingMargins != null) stats.marginOpe.push(s.operatingMargins)
    if (s.profitMargins != null) stats.marginNette.push(s.profitMargins)
  }

  return bySector
}

function isFinancialSector(sector: string | null): boolean {
  return sector === "Financial Services"
}

function isRealEstate(sector: string | null): boolean {
  return sector === "Real Estate"
}

function makeMetric(
  label: string,
  value: number | null,
  note: number,
  weight: number,
  sectorValues: number[] | null,
  opts?: { displayValue?: string; excluded?: boolean; excludedReason?: string | null },
): MetricDetail {
  const sectorMedian = sectorValues ? computeMedian(sectorValues) : null
  const ratioVsSector = value != null && sectorMedian != null && sectorMedian !== 0 ? value / sectorMedian : null
  const sectorPercentile = value != null && sectorValues && sectorValues.length >= 5 ? computePercentile(value, sectorValues) : null

  return {
    value,
    displayValue: opts?.displayValue ?? fmt(value),
    note,
    label,
    weight,
    sectorMedian,
    ratioVsSector,
    sectorPercentile,
    excluded: opts?.excluded ?? false,
    excludedReason: opts?.excludedReason ?? null,
  }
}

// ─── 1. VALORISATION (20%) ───

function scoreValorisationMetrics(
  stock: Stock,
  stats: SectorStats,
): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}
  const isFin = isFinancialSector(stock.sector)
  const medPe = computeMedian(stats.pe)
  const medEvEbitda = computeMedian(stats.evEbitda)
  const medPb = computeMedian(stats.pb)
  const isSmall = stats.count < 5

  // P/E vs secteur
  let notePe = 5
  if (stock.trailingPE != null && stock.trailingPE > 0 && medPe != null && !isSmall) {
    notePe = scoreByRatio(stock.trailingPE, medPe, false) // lower is better
  } else if (stock.trailingPE != null && stock.trailingPE < 0) {
    notePe = stock.forwardPE != null && stock.forwardPE > 0 ? 3 : 0
  }
  detail.pe_vs_secteur = makeMetric("P/E TTM vs secteur", stock.trailingPE, notePe, isFin ? 0.35 : 0.30, stats.pe, {
    displayValue: fmt(stock.trailingPE),
  })

  // P/E forward trend
  let noteForward = 5
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const pctChange = ((stock.forwardPE - stock.trailingPE) / stock.trailingPE) * 100
    noteForward = clamp(lerp(pctChange, [[-30, 10], [-20, 10], [-10, 7], [0, 5], [10, 3], [20, 3], [30, 0]]))
  }
  detail.pe_forward_trend = makeMetric("P/E fwd vs TTM", stock.forwardPE, noteForward, 0.15, null, {
    displayValue: stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0
      ? ((stock.forwardPE - stock.trailingPE) / stock.trailingPE * 100).toFixed(0) + "% vs TTM"
      : fmt(stock.forwardPE),
  })

  // EV/EBITDA vs secteur
  let noteEvEbitda = 5
  const evExcluded = isFin
  if (!evExcluded && stock.evToEbitda != null && stock.evToEbitda > 0 && medEvEbitda != null && !isSmall) {
    noteEvEbitda = scoreByRatio(stock.evToEbitda, medEvEbitda, false)
  }
  detail.ev_ebitda = makeMetric("EV/EBITDA vs secteur", stock.evToEbitda, noteEvEbitda, evExcluded ? 0 : 0.25, stats.evEbitda, {
    excluded: evExcluded,
    excludedReason: evExcluded ? "Non pertinent pour les banques" : null,
  })

  // P/B vs secteur
  let notePb = 5
  if (stock.priceToBook != null && medPb != null && !isSmall) {
    notePb = scoreByRatio(stock.priceToBook, medPb, false)
  }
  detail.pb = makeMetric("P/B vs secteur", stock.priceToBook, notePb, isFin ? 0.30 : 0.15, stats.pb)

  // FCF yield — not available, neutral
  detail.fcf_yield = makeMetric("FCF yield", null, 5, isFin ? 0.20 : 0.15, null, {
    displayValue: "—",
    excluded: true,
    excludedReason: "Données FCF non disponibles",
  })

  // Weights redistribution for financials: P/E 35%, P/B 30%, Fwd 15%, FCF placeholder 20%
  // Standard: P/E 30%, EV/EBITDA 25%, Fwd 15%, P/B 15%, FCF 15%
  const score = isFin
    ? notePe * 0.35 + noteForward * 0.15 + notePb * 0.30 + 5 * 0.20
    : notePe * 0.30 + noteForward * 0.15 + noteEvEbitda * 0.25 + notePb * 0.15 + 5 * 0.15

  return { score: clamp(score), detail }
}

// ─── 2. QUALITÉ / MOAT (20%) ───

function scoreQualiteMetrics(
  stock: Stock,
  stats: SectorStats,
): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}
  const isFin = isFinancialSector(stock.sector)
  const isSmall = stats.count < 5

  // ROE vs secteur (higher is better)
  let noteRoe = 5
  const medRoe = computeMedian(stats.roe)
  if (stock.returnOnEquity != null && medRoe != null && !isSmall) {
    noteRoe = scoreByRatio(stock.returnOnEquity, medRoe, true)
  } else if (stock.returnOnEquity != null) {
    noteRoe = clamp(lerp(stock.returnOnEquity, [[0, 0], [5, 3], [12, 5], [18, 7], [25, 10]]))
  }
  detail.roe = makeMetric("ROE vs secteur", stock.returnOnEquity, noteRoe, isFin ? 0.60 : 0.30, stats.roe, {
    displayValue: fmtPct(stock.returnOnEquity),
  })

  // ROA vs secteur (higher is better)
  let noteRoa = 5
  const medRoa = computeMedian(stats.roa)
  if (stock.returnOnAssets != null && medRoa != null && !isSmall) {
    noteRoa = scoreByRatio(stock.returnOnAssets, medRoa, true)
  } else if (stock.returnOnAssets != null) {
    noteRoa = clamp(lerp(stock.returnOnAssets, [[0, 0], [2, 3], [5, 5], [8, 7], [12, 10]]))
  }
  detail.roa = makeMetric("ROA vs secteur", stock.returnOnAssets, noteRoa, isFin ? 0.40 : 0.15, stats.roa, {
    displayValue: fmtPct(stock.returnOnAssets),
  })

  // Marge opérationnelle vs secteur
  let noteMargeOpe = 5
  const medMargeOpe = computeMedian(stats.marginOpe)
  if (!isFin && stock.operatingMargins != null && medMargeOpe != null && !isSmall) {
    noteMargeOpe = scoreByRatio(stock.operatingMargins, medMargeOpe, true)
  } else if (!isFin && stock.operatingMargins != null) {
    noteMargeOpe = clamp(lerp(stock.operatingMargins, [[0, 0], [5, 3], [10, 5], [18, 7], [25, 10]]))
  }
  detail.marge_ope = makeMetric("Marge opé vs secteur", stock.operatingMargins, noteMargeOpe, isFin ? 0 : 0.30, stats.marginOpe, {
    displayValue: fmtPct(stock.operatingMargins),
    excluded: isFin,
    excludedReason: isFin ? "Non comparable pour les banques" : null,
  })

  // Marge nette vs secteur
  let noteMargeNette = 5
  const medMargeNette = computeMedian(stats.marginNette)
  if (!isFin && stock.profitMargins != null && medMargeNette != null && !isSmall) {
    noteMargeNette = scoreByRatio(stock.profitMargins, medMargeNette, true)
  } else if (!isFin && stock.profitMargins != null) {
    noteMargeNette = clamp(lerp(stock.profitMargins, [[0, 0], [2, 3], [6, 5], [12, 7], [18, 10]]))
  }
  detail.marge_nette = makeMetric("Marge nette vs secteur", stock.profitMargins, noteMargeNette, isFin ? 0 : 0.25, stats.marginNette, {
    displayValue: fmtPct(stock.profitMargins),
    excluded: isFin,
    excludedReason: isFin ? "Non comparable pour les banques" : null,
  })

  const score = isFin
    ? noteRoe * 0.60 + noteRoa * 0.40
    : noteRoe * 0.30 + noteRoa * 0.15 + noteMargeOpe * 0.30 + noteMargeNette * 0.25

  return { score: clamp(score), detail }
}

// ─── 3. CROISSANCE (15%) — not sector-calibrated ───

function scoreCroissanceMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  let noteCa = 5
  if (stock.revenueGrowth != null) {
    noteCa = clamp(lerp(stock.revenueGrowth, [[-10, 0], [0, 3], [3, 5], [10, 7], [20, 10]]))
  }
  detail.croissance_ca = makeMetric("Croissance CA YoY", stock.revenueGrowth, noteCa, 0.35, null, {
    displayValue: fmtPct(stock.revenueGrowth),
  })

  let noteBpa = 5
  if (stock.earningsGrowth != null) {
    const eg = Math.min(stock.earningsGrowth, 500)
    noteBpa = clamp(lerp(eg, [[-20, 0], [0, 3], [3, 5], [12, 7], [25, 10]]))
    if (stock.earningsGrowth > 500) noteBpa = Math.min(noteBpa, 8)
  }
  detail.croissance_bpa = makeMetric("Croissance BPA YoY", stock.earningsGrowth, noteBpa, 0.35, null, {
    displayValue: fmtPct(stock.earningsGrowth),
  })

  let noteTendance = 5
  const fin = stock.annualFinancials
  if (fin.length >= 3) {
    const revenues = fin.slice(-3).map((f) => f.revenue).filter((r): r is number => r != null)
    if (revenues.length >= 3) {
      let yearsUp = 0
      for (let i = 1; i < revenues.length; i++) {
        if (revenues[i] > revenues[i - 1]) yearsUp++
      }
      if (yearsUp === revenues.length - 1) {
        const g1 = (revenues[1] - revenues[0]) / Math.abs(revenues[0])
        const g2 = (revenues[2] - revenues[1]) / Math.abs(revenues[1])
        noteTendance = g2 > g1 ? 10 : 8
      } else if (yearsUp >= 1) {
        noteTendance = 5
      } else {
        noteTendance = 1
      }
    }
  }
  detail.tendance_ca_3ans = makeMetric("Tendance CA 3 ans", null, noteTendance, 0.30, null, {
    displayValue: noteTendance >= 8 ? "Accélération" : noteTendance >= 5 ? "Stable" : "Décélération",
  })

  return { score: clamp(noteCa * 0.35 + noteBpa * 0.35 + noteTendance * 0.30), detail }
}

// ─── 5. DIVIDENDE (10%) ───

function scoreDividendeMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  if (stock.dividendYield == null || stock.dividendYield === 0) {
    detail.rendement = makeMetric("Rendement", 0, 0, 0.25, null, { displayValue: "0%" })
    detail.payout = makeMetric("Payout ratio", stock.payoutRatio, 0, 0.25, null, { displayValue: fmtPct(stock.payoutRatio) })
    detail.historique = makeMetric("Années hausse", null, 0, 0.25, null, { displayValue: "—" })
    detail.croissance_div = makeMetric("Croissance div", null, 0, 0.25, null, { displayValue: "—" })
    return { score: 0, detail }
  }

  const dy = stock.dividendYield
  let noteRendement: number
  if (dy >= 3.5 && dy <= 6.0) noteRendement = 10
  else if ((dy >= 2.5 && dy < 3.5) || (dy > 6.0 && dy <= 7.5)) noteRendement = 7
  else if ((dy >= 1.5 && dy < 2.5)) noteRendement = 5
  else if (dy > 7.5) noteRendement = 3
  else if (dy >= 0.5 && dy < 1.5) noteRendement = 3
  else noteRendement = 1
  detail.rendement = makeMetric("Rendement", dy, noteRendement, 0.25, null, { displayValue: fmtPct(dy) })

  let notePayout = 5
  if (stock.payoutRatio != null) {
    const pr = stock.payoutRatio
    if (pr >= 30 && pr <= 50) notePayout = 10
    else if ((pr >= 50 && pr <= 65) || (pr >= 20 && pr < 30)) notePayout = 7
    else if ((pr >= 65 && pr <= 80) || pr < 20) notePayout = 5
    else if (pr > 80 && pr <= 100) notePayout = 3
    else if (pr > 100) notePayout = 0
  }
  detail.payout = makeMetric("Payout ratio", stock.payoutRatio, notePayout, 0.25, null, { displayValue: fmtPct(stock.payoutRatio) })

  let consecutiveYears = 0
  const divHist = stock.dividendHistory
  if (divHist.length >= 2) {
    for (let i = divHist.length - 1; i > 0; i--) {
      if (divHist[i].total >= divHist[i - 1].total) consecutiveYears++
      else break
    }
  }
  let noteHist = 5
  if (consecutiveYears >= 4) noteHist = 10
  else if (consecutiveYears >= 3) noteHist = 8
  else if (consecutiveYears >= 2) noteHist = 6
  else if (consecutiveYears >= 1) noteHist = 4
  else noteHist = 1
  detail.historique = makeMetric("Années hausse consécutives", consecutiveYears, noteHist, 0.25, null, {
    displayValue: `${consecutiveYears} ans`,
  })

  let noteCroissDiv = 5
  if (divHist.length >= 2) {
    const first = divHist[0].total
    const last = divHist[divHist.length - 1].total
    const years = divHist.length - 1
    if (first > 0 && last > 0 && years > 0) {
      const cagr = (Math.pow(last / first, 1 / years) - 1) * 100
      noteCroissDiv = clamp(lerp(cagr, [[-5, 0], [0, 3], [3, 5], [6, 7], [10, 10]]))
    }
  }
  detail.croissance_div = makeMetric("Croissance dividende CAGR", null, noteCroissDiv, 0.25, null, {
    displayValue: divHist.length >= 2 ? ((Math.pow(divHist[divHist.length-1].total / divHist[0].total, 1/(divHist.length-1)) - 1) * 100).toFixed(1) + "%" : "—",
  })

  let score = clamp(noteRendement * 0.25 + notePayout * 0.25 + noteHist * 0.25 + noteCroissDiv * 0.25)

  // Value trap penalty
  if (dy > 8 && stock.payoutRatio != null && stock.payoutRatio > 90) score = Math.max(0, score - 2)
  // Dividend cut → cap at 3
  if (divHist.length >= 2 && divHist[divHist.length - 1].total < divHist[divHist.length - 2].total * 0.8) score = Math.min(score, 3)

  return { score: clamp(score), detail }
}

// ─── 6. MOMENTUM TECHNIQUE (10%) — not sector-calibrated ───

function scoreMomentumMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  let noteSma200 = 5
  if (stock.priceVsSma200 != null) {
    noteSma200 = clamp(lerp(stock.priceVsSma200, [[-20, 0], [-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10], [25, 10]]))
  }
  detail.vs_sma200 = makeMetric("Prix vs SMA 200", stock.priceVsSma200, noteSma200, 0.30, null, {
    displayValue: stock.priceVsSma200 != null ? (stock.priceVsSma200 >= 0 ? "+" : "") + stock.priceVsSma200.toFixed(1) + "%" : "—",
  })

  let noteCross = 5
  if (stock.sma50 != null && stock.sma200 != null) {
    const crossRatio = (stock.sma50 - stock.sma200) / stock.sma200 * 100
    noteCross = clamp(lerp(crossRatio, [[-10, 0], [-3, 2], [0, 5], [3, 8], [10, 10]]))
  }
  detail.cross = makeMetric("SMA 50 vs SMA 200", null, noteCross, 0.20, null, {
    displayValue: stock.sma50 != null && stock.sma200 != null
      ? (stock.sma50 > stock.sma200 ? "Haussier" : "Baissier")
      : "—",
  })

  let noteRsi = 5
  if (stock.rsi14 != null) {
    const rsi = stock.rsi14
    if (rsi >= 50 && rsi <= 65) noteRsi = 10
    else if ((rsi >= 40 && rsi < 50) || (rsi > 65 && rsi <= 70)) noteRsi = 7
    else if (rsi >= 30 && rsi < 40) noteRsi = 5
    else if (rsi > 70 && rsi <= 80) noteRsi = 3
    else noteRsi = 0
  }
  detail.rsi = makeMetric("RSI (14)", stock.rsi14, noteRsi, 0.25, null, { displayValue: fmt(stock.rsi14) })

  let notePerf6m = 5
  if (stock.perf6M != null) {
    notePerf6m = clamp(lerp(stock.perf6M, [[-30, 0], [-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10], [30, 10]]))
  }
  detail.perf_6m = makeMetric("Perf 6 mois", stock.perf6M, notePerf6m, 0.25, null, {
    displayValue: stock.perf6M != null ? (stock.perf6M >= 0 ? "+" : "") + stock.perf6M.toFixed(1) + "%" : "—",
  })

  return {
    score: clamp(noteSma200 * 0.30 + noteCross * 0.20 + noteRsi * 0.25 + notePerf6m * 0.25),
    detail,
  }
}

// ─── 7. SIGNAUX QUANT (10%) ───
// For US stocks with an ML score: use it directly (LightGBM trained on SEC EDGAR PIT data).
// For all others: rule-based proxy (revision + distance ATH + earnings trend).

function scoreQuantMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  if (stock.mlScore != null) {
    detail.ml_signal = makeMetric("Signal ML (LightGBM EDGAR)", stock.mlScore, stock.mlScore, 1.0, null, {
      displayValue: stock.mlScore.toFixed(1) + " / 10",
    })
    return { score: clamp(stock.mlScore), detail }
  }

  let noteRevision = 5
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const pctDiff = ((stock.forwardPE - stock.trailingPE) / stock.trailingPE) * 100
    noteRevision = clamp(lerp(pctDiff, [[-30, 10], [-15, 8], [-5, 7], [0, 5], [5, 3], [15, 2], [30, 0]]))
  }
  detail.revision_proxy = makeMetric("Révision consensus (proxy)", null, noteRevision, 0.35, null, {
    displayValue: stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0
      ? ((stock.forwardPE - stock.trailingPE) / stock.trailingPE * 100).toFixed(0) + "% vs TTM"
      : "—",
  })

  let noteDistance = 5
  const distPct = stock.fiftyTwoWeekHigh != null && stock.price != null && stock.fiftyTwoWeekHigh > 0
    ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 : null
  if (distPct != null) {
    noteDistance = clamp(lerp(distPct, [[0, 10], [5, 10], [10, 7], [20, 5], [40, 3], [60, 0]]))
  }
  detail.distance_ath = makeMetric("Distance plus haut 52s", distPct, noteDistance, 0.30, null, {
    displayValue: distPct != null ? "-" + distPct.toFixed(1) + "%" : "—",
  })

  let noteSurprise = 5
  const finArr = stock.annualFinancials
  if (finArr.length >= 3) {
    const incomes = finArr.slice(-3).map((f) => f.netIncome).filter((n): n is number => n != null)
    if (incomes.length >= 3) {
      let beats = 0
      for (let i = 1; i < incomes.length; i++) {
        if (incomes[i] > incomes[i - 1]) beats++
      }
      noteSurprise = clamp(lerp(beats, [[0, 2], [1, 5], [2, 9]]))
    }
  }
  detail.tendance_resultats = makeMetric("Tendance résultats", null, noteSurprise, 0.35, null, {
    displayValue: finArr.length >= 3 ? `${finArr.slice(-3).filter((f, i, a) => i > 0 && f.netIncome != null && a[i-1].netIncome != null && f.netIncome! > a[i-1].netIncome!).length}/2 en hausse` : "—",
  })

  return {
    score: clamp(noteRevision * 0.35 + noteDistance * 0.30 + noteSurprise * 0.35),
    detail,
  }
}

// ─── FLAG CATALOG (for filter UI) ───

export const FLAG_CATALOG: { id: FlagId; label: string; emoji: string; type: FlagType }[] = [
  { id: "dividend_aristocrat", label: "Aristocrate", emoji: "👑", type: "positive" },
  { id: "cash_machine", label: "Cash machine", emoji: "💰", type: "positive" },
  { id: "golden_cross", label: "Golden Cross", emoji: "✨", type: "positive" },
  { id: "consensus_up", label: "Révisions ↗", emoji: "📈", type: "positive" },
  { id: "turnaround", label: "Retournement", emoji: "🔄", type: "positive" },
  { id: "value_trap", label: "Value trap", emoji: "⚠️", type: "negative" },
  { id: "death_cross", label: "Death Cross", emoji: "💀", type: "negative" },
  { id: "oversold", label: "Survendu", emoji: "📉", type: "negative" },
  { id: "overbought", label: "Surachat", emoji: "🔥", type: "negative" },
  { id: "fragile_balance", label: "Bilan fragile", emoji: "🏚️", type: "negative" },
]

// ─── FLAGS (10 badges V3) ───

function detectFlags(stock: Stock, stats: SectorStats): StockFlag[] {
  const flags: StockFlag[] = []
  const medPe = computeMedian(stats.pe)
  const divHist = stock.dividendHistory

  // 1. Aristocrate du dividende
  if (divHist.length >= 4) {
    let allUp = true
    for (let i = 1; i < divHist.length; i++) {
      if (divHist[i].total < divHist[i - 1].total) { allUp = false; break }
    }
    if (allUp && stock.payoutRatio != null && stock.payoutRatio < 80 && stock.dividendYield != null && stock.dividendYield > 1.5) {
      flags.push({
        id: "dividend_aristocrat", type: "positive", label: "Aristocrate", emoji: "👑",
        color: "text-yellow-600 dark:text-yellow-400",
        detail: `Dividende en hausse depuis ${divHist.length - 1} ans sans interruption.`,
        priority: 1,
      })
    }
  }

  // 2. Cash machine
  if (
    stock.totalDebt != null && stock.totalCash != null &&
    stock.totalCash > stock.totalDebt &&
    stock.debtToEquity != null && stock.debtToEquity < 50
  ) {
    flags.push({
      id: "cash_machine", type: "positive", label: "Cash machine", emoji: "💰",
      color: "text-emerald-600 dark:text-emerald-400",
      detail: `Trésorerie nette positive, D/E = ${stock.debtToEquity.toFixed(0)}%. Position financière exceptionnelle.`,
      priority: 2,
    })
  }

  // 3. Golden Cross
  if (stock.sma50 != null && stock.sma200 != null) {
    const diff = ((stock.sma50 - stock.sma200) / stock.sma200) * 100
    if (diff > 0 && diff < 3) {
      flags.push({
        id: "golden_cross", type: "positive", label: "Golden Cross", emoji: "✨",
        color: "text-emerald-600 dark:text-emerald-400",
        detail: "La SMA 50 vient de croiser au-dessus de la SMA 200. Signal technique haussier.",
        priority: 3,
      })
    }
  }

  // 4. Consensus en hausse
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const improvement = ((stock.trailingPE - stock.forwardPE) / stock.trailingPE) * 100
    if (improvement > 15) {
      flags.push({
        id: "consensus_up", type: "positive", label: "Révisions ↗", emoji: "📈",
        color: "text-emerald-600 dark:text-emerald-400",
        detail: `P/E forward ${improvement.toFixed(0)}% inférieur au TTM. Les analystes anticipent une amélioration.`,
        priority: 3,
      })
    }
  }

  // 5. Retournement
  if (
    stock.earningsGrowth != null && stock.earningsGrowth > 30 &&
    stock.trailingPE != null && medPe != null && stock.trailingPE > medPe * 1.3 &&
    stock.perf6M != null && stock.perf6M < 0
  ) {
    flags.push({
      id: "turnaround", type: "positive", label: "Retournement", emoji: "🔄",
      color: "text-blue-600 dark:text-blue-400",
      detail: "Les fondamentaux s'améliorent fortement mais le cours n'a pas encore suivi. Potentiel de rattrapage.",
      priority: 4,
    })
  }

  // 6. Value Trap (negative — priority 0)
  if (stock.dividendYield != null && stock.dividendYield > 7) {
    const reasons: string[] = []
    if (stock.payoutRatio != null && stock.payoutRatio > 90) reasons.push("payout insoutenable")
    if (stock.revenueGrowth != null && stock.revenueGrowth < -5) reasons.push("CA en déclin")
    if (stock.debtToEquity != null && stock.debtToEquity > 200) reasons.push("dette élevée")
    if (reasons.length > 0) {
      flags.push({
        id: "value_trap", type: "negative", label: "Value trap", emoji: "⚠️",
        color: "text-red-600 dark:text-red-400",
        detail: `Rendement ${stock.dividendYield.toFixed(1)}% mais ${reasons.join(", ")}. Le dividende risque d'être coupé.`,
        priority: 0,
      })
    }
  }

  // 7. Death Cross
  if (stock.sma50 != null && stock.sma200 != null) {
    const diff = ((stock.sma50 - stock.sma200) / stock.sma200) * 100
    if (diff < 0 && diff > -3) {
      flags.push({
        id: "death_cross", type: "negative", label: "Death Cross", emoji: "💀",
        color: "text-red-600 dark:text-red-400",
        detail: "La SMA 50 vient de croiser sous la SMA 200. Signal technique baissier.",
        priority: 1,
      })
    }
  }

  // 8. Survendu extrême
  if (
    stock.rsi14 != null && stock.rsi14 < 25 &&
    stock.fiftyTwoWeekHigh != null && stock.price != null &&
    ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 > 30
  ) {
    flags.push({
      id: "oversold", type: "negative", label: "Survendu", emoji: "📉",
      color: "text-orange-600 dark:text-orange-400",
      detail: `RSI à ${stock.rsi14.toFixed(0)}, -${(((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100).toFixed(0)}% du plus haut 52s. Survente extrême.`,
      priority: 2,
    })
  }

  // 9. Surachat extrême (NEW in V3)
  if (stock.rsi14 != null && stock.rsi14 > 80 && stock.perf1M != null && stock.perf1M > 20) {
    flags.push({
      id: "overbought", type: "negative", label: "Surachat", emoji: "🔥",
      color: "text-orange-600 dark:text-orange-400",
      detail: `RSI à ${stock.rsi14.toFixed(0)}, +${stock.perf1M.toFixed(0)}% sur 1 mois. Risque de correction à court terme.`,
      priority: 2,
    })
  }

  // 10. Bilan fragile (NEW in V3)
  if (stock.debtToEquity != null && stock.debtToEquity > 250 && !isFinancialSector(stock.sector) && !isRealEstate(stock.sector)) {
    flags.push({
      id: "fragile_balance", type: "negative", label: "Bilan fragile", emoji: "🏚️",
      color: "text-red-600 dark:text-red-400",
      detail: `Debt/Equity = ${stock.debtToEquity.toFixed(0)}%. Vulnérable en cas de hausse des taux ou ralentissement.`,
      priority: 1,
    })
  }

  // Sort: negatives first (priority 0 = most urgent), then positives
  flags.sort((a, b) => {
    if (a.type !== b.type) return a.type === "negative" ? -1 : 1
    return a.priority - b.priority
  })

  return flags
}

// ─── VERDICT TEXT ───

function generateVerdict(pillars: StockScore["pillars"]): string {
  const phrases: string[] = []

  if (pillars.valorisation >= 8.0) phrases.push("Valorisation très attractive")
  else if (pillars.valorisation >= 7.0) phrases.push("Valorisation attractive")
  else if (pillars.valorisation <= 3.0) phrases.push("Valorisation tendue")

  if (pillars.qualite >= 8.0) phrases.push("profitabilité élevée")
  else if (pillars.qualite <= 3.0) phrases.push("rentabilité faible")

  if (pillars.croissance >= 8.0) phrases.push("forte croissance")
  else if (pillars.croissance <= 3.0) phrases.push("croissance en berne")

  if (pillars.sante >= 8.0) phrases.push("bilan solide")
  else if (pillars.sante <= 3.0) phrases.push("bilan fragile — attention à la dette")

  if (pillars.dividende >= 8.0) phrases.push("dividende de qualité")
  else if (pillars.dividende <= 2.0 && pillars.dividende > 0) phrases.push("dividende faible")

  if (pillars.momentum >= 8.0) phrases.push("momentum technique favorable")
  else if (pillars.momentum <= 3.0) phrases.push("tendance baissière")

  if (pillars.quant >= 8.0) phrases.push("signaux quantitatifs positifs")
  else if (pillars.quant <= 3.0) phrases.push("signaux d'alerte")

  if (phrases.length === 0) return "Profil équilibré sans signal fort."
  phrases[0] = phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1)
  return phrases.join(", ") + "."
}

// ─── LABELS ───

function getLabel(score: number): ScoreLabel {
  if (score >= 8.5) return "Achat fort"
  if (score >= 7.0) return "Achat"
  if (score >= 5.5) return "Neutre"
  if (score >= 4.0) return "Sous-performer"
  return "Éviter"
}

function getLabelColor(label: ScoreLabel): string {
  switch (label) {
    case "Achat fort": return "text-emerald-600 dark:text-emerald-400"
    case "Achat": return "text-green-600 dark:text-green-400"
    case "Neutre": return "text-yellow-600 dark:text-yellow-400"
    case "Sous-performer": return "text-orange-600 dark:text-orange-400"
    case "Éviter": return "text-red-600 dark:text-red-400"
  }
}

// ─── MAIN ───

// Regional stats cache: one SectorStats map per region (eu/us/asia)
let cachedRegionalStats: Map<StockRegion, Map<string, SectorStats>> | null = null
let cachedUniverseRef: Stock[] | null = null

function buildRegionalStats(universe: Stock[]): Map<StockRegion, Map<string, SectorStats>> {
  const byRegion = new Map<StockRegion, Stock[]>([["eu", []], ["us", []], ["asia", []]])
  for (const s of universe) {
    byRegion.get(getStockRegion(s))!.push(s)
  }
  const result = new Map<StockRegion, Map<string, SectorStats>>()
  for (const [region, stocks] of byRegion) {
    // Fall back to global pool if regional pool is too small (< 20 stocks)
    result.set(region, computeAllSectorStats(stocks.length >= 20 ? stocks : universe))
  }
  return result
}

export function computeScore(stock: Stock, universe: Stock[]): StockScore {
  if (cachedUniverseRef !== universe) {
    cachedRegionalStats = buildRegionalStats(universe)
    cachedUniverseRef = universe
  }

  const region = getStockRegion(stock)
  const statsForRegion = cachedRegionalStats!.get(region)!
  const sector = stock.sector ?? "Unknown"
  const stats = statsForRegion.get(sector) ?? {
    pe: [], evEbitda: [], pb: [], roe: [], roa: [], marginOpe: [], marginNette: [], count: 0,
  }

  const fin = stock.annualFinancials

  const valo = scoreValorisationMetrics(stock, stats)
  const qual = scoreQualiteMetrics(stock, stats)
  const crois = scoreCroissanceMetrics(stock)
  const sante = scoreSanteMetricsInner(stock, fin)
  const div = scoreDividendeMetrics(stock)
  const mom = scoreMomentumMetrics(stock)
  const quant = scoreQuantMetrics(stock)

  const pillars = {
    valorisation: Math.round(valo.score * 10) / 10,
    qualite: Math.round(qual.score * 10) / 10,
    croissance: Math.round(crois.score * 10) / 10,
    sante: Math.round(sante.score * 10) / 10,
    dividende: Math.round(div.score * 10) / 10,
    momentum: Math.round(mom.score * 10) / 10,
    quant: Math.round(quant.score * 10) / 10,
  }

  const total = clamp(
    pillars.valorisation * 0.20 +
    pillars.qualite * 0.20 +
    pillars.croissance * 0.15 +
    pillars.sante * 0.15 +
    pillars.dividende * 0.10 +
    pillars.momentum * 0.10 +
    pillars.quant * 0.10,
  )

  const label = getLabel(total)
  const flags = detectFlags(stock, stats)

  return {
    total: Math.round(total * 10) / 10,
    label,
    labelColor: getLabelColor(label),
    pillars,
    details: {
      valorisation: valo.detail,
      qualite: qual.detail,
      croissance: crois.detail,
      sante: sante.detail,
      dividende: div.detail,
      momentum: mom.detail,
      quant: quant.detail,
    },
    sectorContext: {
      name: sector,
      count: stats.count,
      isSmall: stats.count < 5,
    },
    flags,
    summary: generateVerdict(pillars),
  }
}

// Inner wrapper to pass fin array
function scoreSanteMetricsInner(
  stock: Stock,
  fin: Stock["annualFinancials"],
): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  let noteDeRatio = 5
  if (stock.debtToEquity != null) {
    const thresholds = isRealEstate(stock.sector)
      ? [[0, 10], [50, 8], [100, 6], [200, 5], [350, 3], [500, 1], [700, 0]] as [number, number][]
      : [[0, 10], [30, 8], [60, 6], [100, 5], [150, 3], [250, 1], [400, 0]] as [number, number][]
    noteDeRatio = clamp(lerp(stock.debtToEquity, thresholds))
  }
  detail.debt_equity = makeMetric("Debt/Equity", stock.debtToEquity, noteDeRatio, isFinancialSector(stock.sector) ? 0 : 0.35, null, {
    displayValue: fmt(stock.debtToEquity, "%"),
    excluded: isFinancialSector(stock.sector),
    excludedReason: isFinancialSector(stock.sector) ? "Non pertinent pour les banques" : null,
  })

  let noteNetDebt = 5
  const netDebt = stock.totalDebt != null && stock.totalCash != null ? stock.totalDebt - stock.totalCash : null
  if (netDebt != null && stock.marketCap != null && stock.marketCap > 0) {
    const ratio = netDebt / stock.marketCap
    noteNetDebt = clamp(lerp(ratio, [[-0.3, 10], [-0.1, 9], [0, 7], [0.3, 5], [0.6, 3], [1.0, 1], [1.5, 0]]))
  }
  detail.dette_nette = makeMetric("Dette nette / Capi", netDebt, noteNetDebt, 0.35, null, {
    displayValue: netDebt != null && stock.marketCap ? (netDebt / stock.marketCap).toFixed(2) + "x" : "—",
  })

  let noteProfitConst = 5
  const recentFin = fin.slice(-3)
  if (recentFin.length >= 3) {
    const positiveYears = recentFin.filter((f) => f.netIncome != null && f.netIncome > 0).length
    noteProfitConst = positiveYears === 3 ? 10 : positiveYears === 2 ? 5 : 1
  }
  detail.profitabilite_constante = makeMetric("Résultat positif (3 ans)", null, noteProfitConst, 0.30, null, {
    displayValue: `${recentFin.filter(f => f.netIncome != null && f.netIncome > 0).length}/${recentFin.length} ans`,
  })

  const score = isFinancialSector(stock.sector)
    ? noteNetDebt * 0.50 + noteProfitConst * 0.50
    : noteDeRatio * 0.35 + noteNetDebt * 0.35 + noteProfitConst * 0.30

  return { score: clamp(score), detail }
}
