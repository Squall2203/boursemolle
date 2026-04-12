import type { Stock } from "@/types/stock"

// ─── Types ───

export type ScoreLabel = "Achat fort" | "Achat" | "Neutre" | "Sous-performer" | "Éviter"

export type FlagId =
  | "dividend_aristocrat"
  | "value_trap"
  | "turnaround"
  | "cash_machine"
  | "oversold"
  | "golden_cross"
  | "death_cross"
  | "consensus_up"

export interface StockFlag {
  id: FlagId
  label: string
  emoji: string
  color: string // tailwind text color class
}

export interface PillarDetail {
  [metricKey: string]: { value: number | null; note: number; label: string }
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
  flags: StockFlag[]
  summary: string
}

// ─── Helpers ───

function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v))
}

function lerp(value: number, breakpoints: [number, number][], inverted = false): number {
  // breakpoints: [[threshold, score], ...] sorted by threshold ascending
  // Linearly interpolate between breakpoints
  const pts = inverted ? [...breakpoints].reverse().map(([t, s]) => [t, 10 - s] as [number, number]) : breakpoints
  if (value <= pts[0][0]) return pts[0][1]
  if (value >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, s0] = pts[i]
    const [t1, s1] = pts[i + 1]
    if (value >= t0 && value <= t1) {
      const ratio = (value - t0) / (t1 - t0)
      return s0 + ratio * (s1 - s0)
    }
  }
  return 5
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ─── Sector medians cache ───

interface SectorMedians {
  pe: number | null
  evEbitda: number | null
  roe: number | null
  marginOpe: number | null
  marginNette: number | null
}

function computeSectorMedians(universe: Stock[]): Map<string, SectorMedians> {
  const bySector = new Map<string, Stock[]>()
  for (const s of universe) {
    const sector = s.sector ?? "Unknown"
    const arr = bySector.get(sector) ?? []
    arr.push(s)
    bySector.set(sector, arr)
  }

  const result = new Map<string, SectorMedians>()
  for (const [sector, stocks] of bySector) {
    result.set(sector, {
      pe: median(stocks.map((s) => s.trailingPE).filter((v): v is number => v != null && v > 0)),
      evEbitda: median(stocks.map((s) => s.evToEbitda).filter((v): v is number => v != null && v > 0)),
      roe: median(stocks.map((s) => s.returnOnEquity).filter((v): v is number => v != null)),
      marginOpe: median(stocks.map((s) => s.operatingMargins).filter((v): v is number => v != null)),
      marginNette: median(stocks.map((s) => s.profitMargins).filter((v): v is number => v != null)),
    })
  }
  return result
}

// ─── Sector calibration ───

const SECTOR_MARGIN_FACTOR: Record<string, number> = {
  Technology: 1.0,
  "Consumer Cyclical": 1.0, // includes luxury
  Industrials: 0.7,
  "Consumer Defensive": 0.5,
  "Basic Materials": 0.8,
  Energy: 0.8,
  Healthcare: 1.0,
  "Communication Services": 0.9,
  Utilities: 0.6,
  "Real Estate": 0.8,
  "Financial Services": 1.0, // special handling in quality
}

function isFinancialSector(sector: string | null): boolean {
  return sector === "Financial Services"
}

function isRealEstate(sector: string | null): boolean {
  return sector === "Real Estate"
}

function getMarginFactor(sector: string | null): number {
  if (!sector) return 1.0
  return SECTOR_MARGIN_FACTOR[sector] ?? 1.0
}

// ─── 1. VALORISATION (20%) ───

function scoreValorisationMetrics(
  stock: Stock,
  sectorMedians: SectorMedians,
): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // P/E vs secteur median
  let notePe = 5
  if (stock.trailingPE != null && stock.trailingPE > 0 && sectorMedians.pe != null) {
    const ratio = stock.trailingPE / sectorMedians.pe
    notePe = clamp(lerp(ratio, [[0.3, 10], [0.5, 10], [0.7, 7], [1.0, 5], [1.5, 3], [2.0, 0]]))
  } else if (stock.trailingPE != null && stock.trailingPE < 0) {
    // Negative P/E = loss-making
    notePe = stock.forwardPE != null && stock.forwardPE > 0 ? 3 : 0
  }
  detail.pe_vs_secteur = { value: stock.trailingPE, note: notePe, label: "P/E vs secteur" }

  // P/E forward vs TTM trend
  let noteForwardTrend = 5
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const pctChange = ((stock.forwardPE - stock.trailingPE) / stock.trailingPE) * 100
    noteForwardTrend = clamp(lerp(pctChange, [[-30, 10], [-20, 10], [-10, 7], [0, 5], [10, 3], [20, 3], [30, 0]]))
  }
  detail.pe_forward_trend = { value: stock.forwardPE, note: noteForwardTrend, label: "P/E fwd vs TTM" }

  // EV/EBITDA vs secteur
  let noteEvEbitda = 5
  const skipEvEbitda = isFinancialSector(stock.sector)
  if (!skipEvEbitda && stock.evToEbitda != null && stock.evToEbitda > 0 && sectorMedians.evEbitda != null) {
    const ratio = stock.evToEbitda / sectorMedians.evEbitda
    noteEvEbitda = clamp(lerp(ratio, [[0.3, 10], [0.5, 10], [0.7, 7], [1.0, 5], [1.5, 3], [2.0, 0]]))
  }
  detail.ev_ebitda = { value: stock.evToEbitda, note: noteEvEbitda, label: "EV/EBITDA vs secteur" }

  // P/B
  let notePb = 5
  if (stock.priceToBook != null) {
    notePb = clamp(lerp(stock.priceToBook, [[0.3, 10], [0.8, 10], [1.2, 7], [2.5, 5], [5.0, 3], [10.0, 0]]))
  }
  detail.pb = { value: stock.priceToBook, note: notePb, label: "Price/Book" }

  // Weights (adjusted for banks: no EV/EBITDA, more P/B)
  let score: number
  if (isFinancialSector(stock.sector)) {
    score = notePe * 0.35 + noteForwardTrend * 0.20 + notePb * 0.30 + noteEvEbitda * 0.00 + 5 * 0.15
  } else {
    score = notePe * 0.30 + noteForwardTrend * 0.15 + noteEvEbitda * 0.30 + notePb * 0.10 + 5 * 0.15
    // 0.15 would be FCF yield — not available, use neutral 5
  }

  return { score: clamp(score), detail }
}

// ─── 2. QUALITÉ / MOAT (20%) ───

function scoreQualiteMetrics(
  stock: Stock,
  _sectorMedians: SectorMedians,
): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}
  const factor = getMarginFactor(stock.sector)

  // ROE
  let noteRoe = 5
  if (stock.returnOnEquity != null) {
    noteRoe = clamp(lerp(stock.returnOnEquity, [[0, 0], [5, 3], [12, 5], [18, 7], [25, 10]]))
  }
  detail.roe = { value: stock.returnOnEquity, note: noteRoe, label: "ROE" }

  // ROA
  let noteRoa = 5
  if (stock.returnOnAssets != null) {
    noteRoa = clamp(lerp(stock.returnOnAssets, [[0, 0], [2, 3], [5, 5], [8, 7], [12, 10]]))
  }
  detail.roa = { value: stock.returnOnAssets, note: noteRoa, label: "ROA" }

  // Marge opérationnelle (sector-adjusted)
  let noteMargeOpe = 5
  if (stock.operatingMargins != null && !isFinancialSector(stock.sector)) {
    const adjusted = stock.operatingMargins / factor
    noteMargeOpe = clamp(lerp(adjusted, [[0, 0], [5, 3], [10, 5], [18, 7], [25, 10]]))
  }
  detail.marge_ope = { value: stock.operatingMargins, note: noteMargeOpe, label: "Marge opérationnelle" }

  // Marge nette (sector-adjusted)
  let noteMargeNette = 5
  if (stock.profitMargins != null && !isFinancialSector(stock.sector)) {
    const adjusted = stock.profitMargins / factor
    noteMargeNette = clamp(lerp(adjusted, [[0, 0], [2, 3], [6, 5], [12, 7], [18, 10]]))
  }
  detail.marge_nette = { value: stock.profitMargins, note: noteMargeNette, label: "Marge nette" }

  // Stabilité ROE — no multi-year data, use neutral
  // Redistributed weight to other metrics

  let score: number
  if (isFinancialSector(stock.sector)) {
    // Banks: ROE only
    score = noteRoe * 0.60 + noteRoa * 0.40
  } else {
    score = noteRoe * 0.30 + noteRoa * 0.15 + noteMargeOpe * 0.30 + noteMargeNette * 0.25
  }

  return { score: clamp(score), detail }
}

// ─── 3. CROISSANCE (15%) ───

function scoreCroissanceMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // Croissance CA YoY
  let noteCa = 5
  if (stock.revenueGrowth != null) {
    noteCa = clamp(lerp(stock.revenueGrowth, [[-10, 0], [0, 3], [3, 5], [10, 7], [20, 10]]))
  }
  detail.croissance_ca = { value: stock.revenueGrowth, note: noteCa, label: "Croissance CA" }

  // Croissance BPA YoY
  let noteBpa = 5
  if (stock.earningsGrowth != null) {
    let eg = stock.earningsGrowth
    // Cap extreme base effects
    if (eg > 500) eg = 500
    noteBpa = clamp(lerp(eg, [[-20, 0], [0, 3], [3, 5], [12, 7], [25, 10]]))
    // Cap at 8 if extreme (base effect)
    if (stock.earningsGrowth > 500) noteBpa = Math.min(noteBpa, 8)
  }
  detail.croissance_bpa = { value: stock.earningsGrowth, note: noteBpa, label: "Croissance BPA" }

  // Tendance CA 3 ans (from annualFinancials)
  let noteTendance = 5
  const fin = stock.annualFinancials
  if (fin.length >= 3) {
    const revenues = fin.slice(-3).map((f) => f.revenue).filter((r): r is number => r != null)
    if (revenues.length >= 3) {
      let yearsUp = 0
      for (let i = 1; i < revenues.length; i++) {
        if (revenues[i] > revenues[i - 1]) yearsUp++
      }
      // 2 years up out of 2 comparisons = acceleration
      if (yearsUp === revenues.length - 1) {
        // Check acceleration: is growth accelerating?
        const g1 = (revenues[1] - revenues[0]) / Math.abs(revenues[0])
        const g2 = (revenues[2] - revenues[1]) / Math.abs(revenues[1])
        noteTendance = g2 > g1 ? 10 : 8
      } else if (yearsUp >= 1) {
        noteTendance = 5
      } else {
        // Check deceleration
        const g1 = (revenues[1] - revenues[0]) / Math.abs(revenues[0])
        const g2 = (revenues[2] - revenues[1]) / Math.abs(revenues[1])
        noteTendance = g2 < g1 ? 0 : 2
      }
    }
  }
  detail.tendance_ca_3ans = { value: null, note: noteTendance, label: "Tendance CA 3 ans" }

  // Surprise BPA: not available — redistribute weight
  const score = clamp(noteCa * 0.35 + noteBpa * 0.35 + noteTendance * 0.30)

  return { score, detail }
}

// ─── 4. SANTÉ FINANCIÈRE (15%) ───

function scoreSanteMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // Debt to equity
  let noteDeRatio = 5
  if (stock.debtToEquity != null) {
    // debtToEquity is in %, convert to ratio feel
    // Lower is better
    noteDeRatio = clamp(lerp(stock.debtToEquity, [[0, 10], [30, 8], [60, 6], [100, 5], [150, 3], [250, 1], [400, 0]]))
  }
  detail.debt_equity = { value: stock.debtToEquity, note: noteDeRatio, label: "Debt/Equity" }

  // Net debt approximation (totalDebt - totalCash) / market cap
  let noteNetDebt = 5
  if (stock.totalDebt != null && stock.totalCash != null && stock.marketCap != null && stock.marketCap > 0) {
    const netDebt = stock.totalDebt - stock.totalCash
    const netDebtRatio = netDebt / stock.marketCap
    // Negative = net cash position
    noteNetDebt = clamp(lerp(netDebtRatio, [[-0.3, 10], [-0.1, 9], [0, 7], [0.3, 5], [0.6, 3], [1.0, 1], [1.5, 0]]))
  }
  detail.dette_nette = { value: stock.totalDebt != null && stock.totalCash != null ? stock.totalDebt - stock.totalCash : null, note: noteNetDebt, label: "Dette nette / Capi" }

  // FCF consistency from annualFinancials (net income as proxy)
  let noteFcfConsist = 5
  const fin = stock.annualFinancials
  if (fin.length >= 3) {
    const netIncomes = fin.slice(-3).map((f) => f.netIncome)
    const positiveYears = netIncomes.filter((n) => n != null && n > 0).length
    if (positiveYears === 3) noteFcfConsist = 10
    else if (positiveYears === 2) noteFcfConsist = 5
    else noteFcfConsist = 1
  }
  detail.profitabilite_constante = { value: null, note: noteFcfConsist, label: "Résultat positif (3 ans)" }

  // Assouplir pour l'immobilier
  if (isRealEstate(stock.sector) && noteDeRatio < 5) {
    noteDeRatio = Math.min(noteDeRatio + 2, 5)
  }

  const score = clamp(noteDeRatio * 0.35 + noteNetDebt * 0.35 + noteFcfConsist * 0.30)

  return { score, detail }
}

// ─── 5. DIVIDENDE (10%) ───

function scoreDividendeMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // No dividend = 0
  if (stock.dividendYield == null || stock.dividendYield === 0) {
    detail.rendement = { value: 0, note: 0, label: "Rendement" }
    detail.payout = { value: stock.payoutRatio, note: 0, label: "Payout ratio" }
    detail.historique = { value: null, note: 0, label: "Historique" }
    detail.croissance_div = { value: null, note: 0, label: "Croissance dividende" }
    return { score: 0, detail }
  }

  // Rendement — sweet spot 3.5-6%
  let noteRendement = 5
  const dy = stock.dividendYield
  if (dy >= 3.5 && dy <= 6.0) noteRendement = 10
  else if (dy >= 2.5 && dy < 3.5) noteRendement = 7
  else if (dy > 6.0 && dy <= 7.5) noteRendement = 7
  else if (dy >= 1.5 && dy < 2.5) noteRendement = 5
  else if (dy > 7.5) noteRendement = 3
  else if (dy >= 0.5 && dy < 1.5) noteRendement = 3
  else noteRendement = 1
  detail.rendement = { value: dy, note: noteRendement, label: "Rendement" }

  // Payout ratio — sweet spot 30-50%
  let notePayout = 5
  if (stock.payoutRatio != null) {
    const pr = stock.payoutRatio
    if (pr >= 30 && pr <= 50) notePayout = 10
    else if ((pr >= 50 && pr <= 65) || (pr >= 20 && pr < 30)) notePayout = 7
    else if ((pr >= 65 && pr <= 80) || (pr < 20)) notePayout = 5
    else if (pr > 80 && pr <= 100) notePayout = 3
    else if (pr > 100) notePayout = 0
  }
  detail.payout = { value: stock.payoutRatio, note: notePayout, label: "Payout ratio" }

  // Années consécutives de hausse from dividendHistory
  let noteHistorique = 5
  let consecutiveYears = 0
  const divHist = stock.dividendHistory
  if (divHist.length >= 2) {
    consecutiveYears = 0
    for (let i = divHist.length - 1; i > 0; i--) {
      if (divHist[i].total >= divHist[i - 1].total) consecutiveYears++
      else break
    }
    // We only have ~5 years of data, so scale accordingly
    if (consecutiveYears >= 4) noteHistorique = 10
    else if (consecutiveYears >= 3) noteHistorique = 8
    else if (consecutiveYears >= 2) noteHistorique = 6
    else if (consecutiveYears >= 1) noteHistorique = 4
    else noteHistorique = 1
  }
  detail.historique = { value: consecutiveYears, note: noteHistorique, label: "Années hausse consécutives" }

  // Croissance dividende CAGR
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
  detail.croissance_div = { value: null, note: noteCroissDiv, label: "Croissance dividende" }

  let score = clamp(
    noteRendement * 0.25 + notePayout * 0.25 + noteHistorique * 0.25 + noteCroissDiv * 0.25,
  )

  // Value trap penalty: yield > 8% AND payout > 90%
  if (dy > 8 && stock.payoutRatio != null && stock.payoutRatio > 90) {
    score = Math.max(0, score - 2)
  }

  // Dividend cut in last 2 years → cap at 3
  if (divHist.length >= 2) {
    const lastTwo = divHist.slice(-2)
    if (lastTwo.length === 2 && lastTwo[1].total < lastTwo[0].total * 0.8) {
      score = Math.min(score, 3)
    }
  }

  return { score: clamp(score), detail }
}

// ─── 6. MOMENTUM TECHNIQUE (10%) ───

function scoreMomentumMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // Position vs SMA 200
  let noteSma200 = 5
  if (stock.priceVsSma200 != null) {
    noteSma200 = clamp(lerp(stock.priceVsSma200, [[-20, 0], [-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10], [25, 10]]))
  }
  detail.vs_sma200 = { value: stock.priceVsSma200, note: noteSma200, label: "Prix vs SMA 200" }

  // Golden/Death cross (SMA50 vs SMA200)
  let noteCross = 5
  if (stock.sma50 != null && stock.sma200 != null) {
    const crossRatio = (stock.sma50 - stock.sma200) / stock.sma200 * 100
    // Positive = golden cross territory, negative = death cross
    noteCross = clamp(lerp(crossRatio, [[-10, 0], [-3, 2], [0, 5], [3, 8], [10, 10]]))
  }
  detail.cross = { value: stock.sma50 != null && stock.sma200 != null ? stock.sma50 - stock.sma200 : null, note: noteCross, label: "Golden/Death Cross" }

  // RSI
  let noteRsi = 5
  if (stock.rsi14 != null) {
    const rsi = stock.rsi14
    if (rsi >= 50 && rsi <= 65) noteRsi = 10
    else if ((rsi >= 40 && rsi < 50) || (rsi > 65 && rsi <= 70)) noteRsi = 7
    else if (rsi >= 30 && rsi < 40) noteRsi = 5
    else if (rsi > 70 && rsi <= 80) noteRsi = 3
    else noteRsi = 0 // < 30 or > 80
  }
  detail.rsi = { value: stock.rsi14, note: noteRsi, label: "RSI (14)" }

  // Perf 6 mois (absolute as proxy — no benchmark data)
  let notePerf6m = 5
  if (stock.perf6M != null) {
    notePerf6m = clamp(lerp(stock.perf6M, [[-30, 0], [-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10], [30, 10]]))
  }
  detail.perf_6m = { value: stock.perf6M, note: notePerf6m, label: "Perf 6 mois" }

  const score = clamp(
    noteSma200 * 0.30 + noteCross * 0.20 + noteRsi * 0.25 + notePerf6m * 0.25,
  )

  return { score, detail }
}

// ─── 7. SIGNAUX QUANT (10%) — MVP ───

function scoreQuantMetrics(stock: Stock): { score: number; detail: PillarDetail } {
  const detail: PillarDetail = {}

  // Revision proxy: P/E forward vs TTM — if forward < TTM, analysts expect improvement
  let noteRevision = 5
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const pctDiff = ((stock.forwardPE - stock.trailingPE) / stock.trailingPE) * 100
    // Negative = forward cheaper = positive revision
    noteRevision = clamp(lerp(pctDiff, [[-30, 10], [-15, 8], [-5, 7], [0, 5], [5, 3], [15, 2], [30, 0]]))
  }
  detail.revision_proxy = { value: stock.forwardPE, note: noteRevision, label: "Révision consensus (proxy)" }

  // Distance au plus haut 52 semaines
  let noteDistance = 5
  if (stock.fiftyTwoWeekHigh != null && stock.price != null && stock.fiftyTwoWeekHigh > 0) {
    const distPct = ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100
    noteDistance = clamp(lerp(distPct, [[0, 10], [5, 10], [10, 7], [20, 5], [40, 3], [60, 0]]))
  }
  detail.distance_ath = { value: stock.fiftyTwoWeekHigh != null && stock.price != null ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 : null, note: noteDistance, label: "Distance plus haut 52s" }

  // Earnings surprise trend: use annualFinancials net income trend as proxy
  let noteSurprise = 5
  const fin = stock.annualFinancials
  if (fin.length >= 3) {
    const incomes = fin.slice(-3).map((f) => f.netIncome).filter((n): n is number => n != null)
    if (incomes.length >= 3) {
      let beats = 0
      for (let i = 1; i < incomes.length; i++) {
        if (incomes[i] > incomes[i - 1]) beats++
      }
      noteSurprise = clamp(lerp(beats, [[0, 2], [1, 5], [2, 9]]))
    }
  }
  detail.tendance_resultats = { value: null, note: noteSurprise, label: "Tendance résultats" }

  // MVP weights (redistributed from missing insider/short interest)
  const score = clamp(
    noteRevision * 0.35 + noteDistance * 0.30 + noteSurprise * 0.35,
  )

  return { score, detail }
}

// ─── FLAGS ───

const FLAG_DEFS: Record<FlagId, { label: string; emoji: string; color: string }> = {
  dividend_aristocrat: { label: "Aristocrate", emoji: "👑", color: "text-yellow-600 dark:text-yellow-400" },
  value_trap: { label: "Value trap", emoji: "⚠️", color: "text-red-600 dark:text-red-400" },
  turnaround: { label: "Retournement", emoji: "🔄", color: "text-blue-600 dark:text-blue-400" },
  cash_machine: { label: "Cash machine", emoji: "💰", color: "text-emerald-600 dark:text-emerald-400" },
  oversold: { label: "Survendu", emoji: "📉", color: "text-orange-600 dark:text-orange-400" },
  golden_cross: { label: "Golden Cross", emoji: "✨", color: "text-emerald-600 dark:text-emerald-400" },
  death_cross: { label: "Death Cross", emoji: "💀", color: "text-red-600 dark:text-red-400" },
  consensus_up: { label: "Révisions ↗", emoji: "📈", color: "text-emerald-600 dark:text-emerald-400" },
}

function detectFlags(stock: Stock, sectorMedians: SectorMedians): StockFlag[] {
  const flags: StockFlag[] = []

  // Dividend Aristocrat: consecutive years of dividend increase >= 4 (best we can do with ~5y data)
  const divHist = stock.dividendHistory
  if (divHist.length >= 4) {
    let allUp = true
    for (let i = 1; i < divHist.length; i++) {
      if (divHist[i].total < divHist[i - 1].total) { allUp = false; break }
    }
    if (allUp && divHist.length >= 4) {
      flags.push({ id: "dividend_aristocrat", ...FLAG_DEFS.dividend_aristocrat })
    }
  }

  // Value Trap: yield > 7% AND payout > 90%
  if (stock.dividendYield != null && stock.dividendYield > 7 && stock.payoutRatio != null && stock.payoutRatio > 90) {
    flags.push({ id: "value_trap", ...FLAG_DEFS.value_trap })
  }

  // Turnaround: P/E > 2x sector BUT earnings growth > 50%
  if (
    stock.trailingPE != null && sectorMedians.pe != null &&
    stock.trailingPE > sectorMedians.pe * 2 &&
    stock.earningsGrowth != null && stock.earningsGrowth > 50
  ) {
    flags.push({ id: "turnaround", ...FLAG_DEFS.turnaround })
  }

  // Cash Machine: low debt + high cash relative to market cap
  if (
    stock.totalDebt != null && stock.totalCash != null && stock.marketCap != null &&
    stock.totalCash > stock.totalDebt && // net cash
    stock.debtToEquity != null && stock.debtToEquity < 50
  ) {
    flags.push({ id: "cash_machine", ...FLAG_DEFS.cash_machine })
  }

  // Oversold: RSI < 25 AND distance ATH > 30%
  if (
    stock.rsi14 != null && stock.rsi14 < 25 &&
    stock.fiftyTwoWeekHigh != null && stock.price != null &&
    ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 > 30
  ) {
    flags.push({ id: "oversold", ...FLAG_DEFS.oversold })
  }

  // Golden Cross: SMA50 > SMA200 and close together (recently crossed)
  if (stock.sma50 != null && stock.sma200 != null) {
    const diff = ((stock.sma50 - stock.sma200) / stock.sma200) * 100
    if (diff > 0 && diff < 3) {
      flags.push({ id: "golden_cross", ...FLAG_DEFS.golden_cross })
    }
    if (diff < 0 && diff > -3) {
      flags.push({ id: "death_cross", ...FLAG_DEFS.death_cross })
    }
  }

  // Consensus up: forward P/E significantly lower than trailing
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const improvement = ((stock.trailingPE - stock.forwardPE) / stock.trailingPE) * 100
    if (improvement > 15) {
      flags.push({ id: "consensus_up", ...FLAG_DEFS.consensus_up })
    }
  }

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

let cachedMedians: Map<string, SectorMedians> | null = null
let cachedUniverseRef: Stock[] | null = null

export function computeScore(stock: Stock, universe: Stock[]): StockScore {
  // Cache sector medians across calls for the same universe
  if (cachedUniverseRef !== universe) {
    cachedMedians = computeSectorMedians(universe)
    cachedUniverseRef = universe
  }

  const sector = stock.sector ?? "Unknown"
  const sectorMed = cachedMedians!.get(sector) ?? {
    pe: null, evEbitda: null, roe: null, marginOpe: null, marginNette: null,
  }

  const valo = scoreValorisationMetrics(stock, sectorMed)
  const qual = scoreQualiteMetrics(stock, sectorMed)
  const crois = scoreCroissanceMetrics(stock)
  const sante = scoreSanteMetrics(stock)
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
  const flags = detectFlags(stock, sectorMed)

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
    flags,
    summary: generateVerdict(pillars),
  }
}
