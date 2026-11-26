import type { Stock } from "../types/stock"
import { getStockRegion, type StockRegion } from "./market"
import { getGrade } from "./grades"

// ─── Types ───

/** Appréciation affichée à côté de la note. Volontairement descriptive : ce n'est pas une recommandation. */
export type ScoreLabel = string

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
  /** Note sur 10. Sans objet quand `missing` ou `excluded` est vrai. */
  note: number
  label: string
  weight: number
  sectorMedian: number | null
  ratioVsSector: number | null
  sectorPercentile: number | null
  excluded: boolean
  excludedReason: string | null
  /** Donnée absente : le critère n'entre pas dans la note (il ne vaut plus 5 par défaut). */
  missing: boolean
  /** Phrase en clair : ce que dit ce chiffre pour cette action. */
  explanation: string | null
}

export interface PillarDetail {
  [metricKey: string]: MetricDetail
}

export type PillarKey = "valorisation" | "qualite" | "croissance" | "sante" | "dividende" | "momentum" | "quant"

export interface PillarExplanation {
  /** Nom complet du critère */
  title: string
  /** Ce que le critère cherche à mesurer, en une phrase pour un non-initié */
  question: string
  /** Lecture de la note de cette action */
  verdict: string
  /** Une phrase par chiffre utilisé */
  points: string[]
  /** Faux quand le critère ne compte pas dans la note globale (pas de dividende, aucune donnée) */
  counted: boolean
  /** Part des données attendues réellement disponibles (0 à 1) */
  coverage: number
}

export interface SectorContext {
  name: string
  count: number
  isSmall: boolean // < 8 sociétés comparables
}

export interface StockScore {
  total: number
  label: ScoreLabel
  labelColor: string
  pillars: Record<PillarKey, number>
  details: Record<PillarKey, PillarDetail>
  explanations: Record<PillarKey, PillarExplanation>
  /** Poids effectif de chaque critère dans la note de cette action (somme = 1) */
  weights: Record<PillarKey, number>
  /** Jusqu'à trois raisons principales qui tirent la note vers le haut */
  strengths: string[]
  /** Jusqu'à trois raisons principales qui la tirent vers le bas ou appellent à la prudence */
  watchPoints: string[]
  /** Part des données attendues réellement disponibles pour cette action (0 à 1) */
  dataCoverage: number
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

/** Part (0 à 100) des valeurs du secteur situées sous `value` ; les ex æquo comptent pour moitié. */
function computePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50
  let below = 0
  let equal = 0
  for (const v of values) {
    if (v < value) below++
    else if (v === value) equal++
  }
  return Math.round(((below + equal / 2) / values.length) * 100)
}

/** Nombre au format français (virgule décimale). */
function fr(v: number, digits = 1): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

function fmt(v: number | null, suffix = ""): string {
  if (v == null) return "—"
  return fr(v) + suffix
}

function fmtPct(v: number | null): string {
  if (v == null) return "—"
  return fr(v) + " %"
}

function signedPct(v: number): string {
  return (v >= 0 ? "+" : "") + fr(v) + " %"
}

const SECTOR_FR: Record<string, string> = {
  "Technology": "la technologie",
  "Healthcare": "la santé",
  "Financial Services": "la finance",
  "Consumer Cyclical": "la consommation cyclique",
  "Consumer Defensive": "la consommation de base",
  "Industrials": "l'industrie",
  "Communication Services": "les télécoms et médias",
  "Basic Materials": "les matériaux de base",
  "Real Estate": "l'immobilier",
  "Energy": "l'énergie",
  "Utilities": "les services aux collectivités",
}

function sectorLabel(sector: string | null): string {
  return sector && SECTOR_FR[sector] ? `du secteur de ${SECTOR_FR[sector]}` : "de son secteur"
}

/** Nombre minimal de sociétés comparables pour noter par rapport au secteur plutôt que sur une grille fixe. */
const MIN_SECTOR_SAMPLE = 8

// ─── Sector stats ───

interface SectorStats {
  pe: number[]
  evEbitda: number[]
  pb: number[]
  fcfYield: number[]
  roe: number[]
  roa: number[]
  marginOpe: number[]
  marginNette: number[]
  count: number
}

const EMPTY_STATS: SectorStats = { pe: [], evEbitda: [], pb: [], fcfYield: [], roe: [], roa: [], marginOpe: [], marginNette: [], count: 0 }

function computeAllSectorStats(universe: Stock[]): Map<string, SectorStats> {
  const bySector = new Map<string, SectorStats>()

  for (const s of universe) {
    const sector = s.sector ?? "Unknown"
    let stats = bySector.get(sector)
    if (!stats) {
      stats = { pe: [], evEbitda: [], pb: [], fcfYield: [], roe: [], roa: [], marginOpe: [], marginNette: [], count: 0 }
      bySector.set(sector, stats)
    }
    stats.count++
    if (s.trailingPE != null && s.trailingPE > 0) stats.pe.push(s.trailingPE)
    if (s.evToEbitda != null && s.evToEbitda > 0) stats.evEbitda.push(s.evToEbitda)
    if (s.priceToBook != null && s.priceToBook > 0) stats.pb.push(s.priceToBook)
    if (s.freeCashflowYield != null) stats.fcfYield.push(s.freeCashflowYield)
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

// ─── Construction d'un critère à partir de ses chiffres ───

interface MetricInput {
  key: string
  label: string
  value: number | null
  displayValue?: string
  /** null = donnée absente */
  note: number | null
  weight: number
  sectorValues?: number[] | null
  excludedReason?: string | null
  explanation?: string | null
}

interface PillarResult {
  score: number
  detail: PillarDetail
  /** Part du poids prévu couverte par des données disponibles */
  coverage: number
  /** Faux si le critère ne doit pas compter dans la note globale */
  counted: boolean
}

function buildPillar(inputs: MetricInput[]): PillarResult {
  const detail: PillarDetail = {}
  let weighted = 0
  let usedWeight = 0
  let expectedWeight = 0

  for (const m of inputs) {
    const excluded = m.excludedReason != null
    const missing = !excluded && m.note == null
    const sectorValues = m.sectorValues ?? null
    const sectorMedian = sectorValues ? computeMedian(sectorValues) : null

    detail[m.key] = {
      value: m.value,
      displayValue: m.displayValue ?? fmt(m.value),
      note: m.note ?? 0,
      label: m.label,
      weight: excluded ? 0 : m.weight,
      sectorMedian,
      ratioVsSector: m.value != null && sectorMedian != null && sectorMedian !== 0 ? m.value / sectorMedian : null,
      sectorPercentile: m.value != null && sectorValues && sectorValues.length >= MIN_SECTOR_SAMPLE
        ? computePercentile(m.value, sectorValues) : null,
      excluded,
      excludedReason: m.excludedReason ?? null,
      missing,
      explanation: excluded || missing ? null : (m.explanation ?? null),
    }

    if (excluded) continue
    expectedWeight += m.weight
    if (m.note != null) {
      weighted += m.note * m.weight
      usedWeight += m.weight
    }
  }

  // La note est la moyenne des seuls critères renseignés : une donnée absente ne vaut plus 5 d'office.
  const score = usedWeight > 0 ? clamp(weighted / usedWeight) : 5
  const coverage = expectedWeight > 0 ? usedWeight / expectedWeight : 0
  return { score, detail, coverage, counted: usedWeight > 0 }
}

/**
 * Note d'un chiffre par rapport aux sociétés comparables : sa position dans le secteur, de 0 (dernier) à 10 (premier).
 * Robuste aux médianes négatives ou proches de zéro, contrairement à un rapport à la médiane.
 */
function noteByRank(value: number, sectorValues: number[], lowerIsBetter: boolean): number {
  const pct = computePercentile(value, sectorValues)
  return clamp((lowerIsBetter ? 100 - pct : pct) / 10)
}

/** « moins chère que 64 % » / « plus rentable que 71 % » : part du secteur que l'action devance. */
function beatsShare(value: number, sectorValues: number[], lowerIsBetter: boolean): number {
  const pct = computePercentile(value, sectorValues)
  return lowerIsBetter ? 100 - pct : pct
}

// ─── 1. VALORISATION ───

function scoreValorisation(stock: Stock, stats: SectorStats): PillarResult {
  const isFin = isFinancialSector(stock.sector)
  const sect = sectorLabel(stock.sector)
  const inputs: MetricInput[] = []
  // La trésorerie dégagée entre dans le critère dès que les données la fournissent (hors banques et assureurs,
  // dont la trésorerie ne se lit pas ainsi). Les autres chiffres lui cèdent alors une part de leur poids,
  // dans les mêmes proportions. Les données plus anciennes, qui ne la contiennent pas, sont notées comme avant.
  const withFcf = !isFin && stock.freeCashflowYield !== undefined
  const w = withFcf
    ? { pe: 0.27, fwd: 0.12, ev: 0.23, pb: 0.15, fcf: 0.23 }
    : { pe: isFin ? 0.45 : 0.35, fwd: 0.15, ev: 0.30, pb: isFin ? 0.40 : 0.20, fcf: 0 }

  // PER : prix payé pour 1 € de bénéfice annuel
  {
    const pe = stock.trailingPE
    const enough = stats.pe.length >= MIN_SECTOR_SAMPLE
    let note: number | null = null
    let explanation: string | null = null
    if (pe != null && pe > 0) {
      const med = computeMedian(stats.pe)
      if (enough && med != null) {
        note = noteByRank(pe, stats.pe, true)
        const share = beatsShare(pe, stats.pe, true)
        explanation = `L'action se paie ${fr(pe)} fois ses bénéfices annuels (PER), contre ${fr(med)} pour la société médiane ${sect}. Elle est moins chère que ${share} % des sociétés comparables.`
      } else {
        note = clamp(lerp(pe, [[5, 10], [10, 8], [15, 6.5], [20, 5], [30, 3], [50, 1]]))
        explanation = `L'action se paie ${fr(pe)} fois ses bénéfices annuels (PER). Trop peu de sociétés comparables pour situer ce chiffre dans son secteur : il est noté sur une grille générale (autour de 15, un prix moyen).`
      }
    } else if ((pe != null && pe <= 0) || (pe == null && stock.profitMargins != null && stock.profitMargins < 0)) {
      note = stock.forwardPE != null && stock.forwardPE > 0 ? 3 : 1
      explanation = stock.forwardPE != null && stock.forwardPE > 0
        ? "L'entreprise a perdu de l'argent sur les douze derniers mois, donc son prix ne peut pas être rapporté à ses bénéfices. Les analystes attendent toutefois un retour aux bénéfices."
        : "L'entreprise a perdu de l'argent sur les douze derniers mois : son prix ne peut pas être rapporté à ses bénéfices, ce qui pèse sur la note."
    }
    inputs.push({
      key: "pe_vs_secteur", label: "PER vs secteur", value: pe, note, weight: w.pe,
      sectorValues: stats.pe, explanation,
    })
  }

  // Bénéfices attendus : PER calculé sur les bénéfices prévus vs bénéfices passés
  {
    const pe = stock.trailingPE
    const fwd = stock.forwardPE
    let note: number | null = null
    let explanation: string | null = null
    let display = fmt(fwd)
    if (fwd != null && pe != null && pe > 0 && fwd > 0) {
      const pctChange = ((fwd - pe) / pe) * 100
      note = clamp(lerp(pctChange, [[-30, 10], [-20, 9], [-10, 7], [0, 5], [10, 3], [30, 0]]))
      display = `${fr(fwd)} (${signedPct(pctChange)})`
      explanation = pctChange < -3
        ? `Rapporté aux bénéfices attendus par les analystes pour l'an prochain, le PER tombe à ${fr(fwd)} : le marché anticipe des bénéfices en hausse, ce qui rend le prix actuel plus facile à justifier. Ce sont des prévisions, pas des résultats.`
        : pctChange > 3
          ? `Rapporté aux bénéfices attendus pour l'an prochain, le PER monte à ${fr(fwd)} : les analystes anticipent des bénéfices en baisse, l'action est donc plus chère qu'elle n'en a l'air.`
          : `Les analystes attendent des bénéfices stables l'an prochain (PER prévisionnel de ${fr(fwd)}).`
    }
    inputs.push({ key: "pe_forward_trend", label: "PER sur bénéfices attendus", value: fwd, displayValue: display, note, weight: w.fwd, explanation })
  }

  // VE/EBITDA : prix de l'entreprise entière, dette comprise
  {
    const v = stock.evToEbitda
    let note: number | null = null
    let explanation: string | null = null
    if (!isFin && v != null && v > 0) {
      const med = computeMedian(stats.evEbitda)
      if (stats.evEbitda.length >= MIN_SECTOR_SAMPLE && med != null) {
        note = noteByRank(v, stats.evEbitda, true)
        explanation = `En comptant aussi sa dette, l'entreprise vaut ${fr(v)} fois son résultat d'exploitation avant amortissements (VE/EBITDA), contre ${fr(med)} pour la médiane du secteur. Cet indicateur évite de trouver bon marché une société très endettée.`
      } else {
        note = clamp(lerp(v, [[4, 10], [8, 7.5], [12, 5], [18, 3], [30, 0]]))
        explanation = `En comptant aussi sa dette, l'entreprise vaut ${fr(v)} fois son résultat d'exploitation avant amortissements (VE/EBITDA).`
      }
    }
    inputs.push({
      key: "ev_ebitda", label: "VE/EBITDA vs secteur", value: v, note, weight: w.ev, sectorValues: stats.evEbitda,
      excludedReason: isFin ? "Non pertinent pour les banques et assureurs" : null, explanation,
    })
  }

  // Cours / actif net
  {
    const v = stock.priceToBook
    let note: number | null = null
    let explanation: string | null = null
    if (v != null && v > 0) {
      const med = computeMedian(stats.pb)
      if (stats.pb.length >= MIN_SECTOR_SAMPLE && med != null) {
        note = noteByRank(v, stats.pb, true)
        explanation = `L'action vaut ${fr(v, 2)} fois la valeur comptable de l'entreprise (ce qui resterait aux actionnaires si elle vendait tout et remboursait ses dettes), contre ${fr(med, 2)} pour la médiane du secteur.`
      } else {
        note = clamp(lerp(v, [[0.5, 10], [1, 8], [2, 6], [4, 4], [8, 2], [15, 0]]))
        explanation = `L'action vaut ${fr(v, 2)} fois la valeur comptable de l'entreprise.`
      }
    }
    inputs.push({ key: "pb", label: "Cours / actif net vs secteur", value: v, displayValue: v != null ? fr(v, 2) : "—", note, weight: w.pb, sectorValues: stats.pb, explanation })
  }

  // Trésorerie dégagée : l'argent réellement encaissé sur l'exercice, rapporté à la valeur en Bourse
  if (withFcf) {
    const v = stock.freeCashflowYield ?? null
    let note: number | null = null
    let explanation: string | null = null
    if (v != null) {
      const med = computeMedian(stats.fcfYield)
      const enough = stats.fcfYield.length >= MIN_SECTOR_SAMPLE && med != null
      note = enough
        ? noteByRank(v, stats.fcfYield, false)
        : clamp(lerp(v, [[-5, 0], [0, 2], [3, 5], [6, 7.5], [10, 10]]))
      const versus = enough ? `, contre ${fr(med!)} € pour la société médiane ${sect}` : ""
      explanation = v > 0
        ? `Sur son dernier exercice, l'entreprise a dégagé ${fr(v)} € de trésorerie pour 100 € de valeur en Bourse${versus}. La trésorerie dégagée est l'argent réellement encaissé une fois payés les dépenses courantes et les investissements : elle est plus difficile à embellir qu'un bénéfice comptable.`
        : v > -100
          ? `Sur son dernier exercice, l'entreprise a dépensé plus d'argent qu'elle n'en a encaissé : sa trésorerie dégagée est négative (${fr(v)} € pour 100 € de valeur en Bourse${versus}). Cela peut venir de gros investissements comme d'une activité qui consomme de l'argent.`
          : "Sur son dernier exercice, l'entreprise a dépensé bien plus d'argent qu'elle n'en a encaissé : sa trésorerie dégagée est négative, pour un montant supérieur à sa valeur en Bourse actuelle. Elle dépend de financements extérieurs pour continuer."
    }
    inputs.push({
      key: "fcf_yield", label: "Trésorerie dégagée / valeur en Bourse", value: v, displayValue: v != null ? `${fr(v)} %` : "—",
      note, weight: w.fcf, sectorValues: stats.fcfYield, explanation,
    })
  }

  return buildPillar(inputs)
}

// ─── 2. RENTABILITÉ ───

function scoreQualite(stock: Stock, stats: SectorStats): PillarResult {
  const isFin = isFinancialSector(stock.sector)
  const sect = sectorLabel(stock.sector)

  function ranked(
    value: number | null, sectorValues: number[], fallback: [number, number][],
    sentence: (v: number, share: number | null, med: number | null) => string,
  ): { note: number | null; explanation: string | null } {
    if (value == null) return { note: null, explanation: null }
    const med = computeMedian(sectorValues)
    if (sectorValues.length >= MIN_SECTOR_SAMPLE && med != null) {
      return { note: noteByRank(value, sectorValues, false), explanation: sentence(value, beatsShare(value, sectorValues, false), med) }
    }
    return { note: clamp(lerp(value, fallback)), explanation: sentence(value, null, null) }
  }

  const vsSector = (share: number | null, med: number | null, unit: string) =>
    share != null && med != null ? ` La médiane ${sect} est à ${fr(med)} ${unit} : l'entreprise fait mieux que ${share} % des sociétés comparables.` : ""

  const roe = ranked(stock.returnOnEquity, stats.roe, [[0, 0], [5, 3], [12, 5], [18, 7], [25, 10]], (v, share, med) =>
    v > 0
      ? `Pour 100 € confiés par ses actionnaires, l'entreprise dégage ${fr(v)} € de bénéfice par an (rentabilité des capitaux propres, ou ROE).${vsSector(share, med, "%")}`
      : `L'entreprise perd de l'argent rapporté aux capitaux de ses actionnaires (ROE de ${fr(v)} %).${vsSector(share, med, "%")}`)

  const roa = ranked(stock.returnOnAssets, stats.roa, [[0, 0], [2, 3], [5, 5], [8, 7], [12, 10]], (v, share, med) =>
    `Rapporté à tout ce qu'elle possède (usines, stocks, trésorerie), l'entreprise dégage ${fr(v)} % par an (ROA). Contrairement au ROE, ce chiffre n'est pas gonflé par l'endettement.${vsSector(share, med, "%")}`)

  const mo = ranked(stock.operatingMargins, stats.marginOpe, [[0, 0], [5, 3], [10, 5], [18, 7], [25, 10]], (v, share, med) =>
    `Sur 100 € de ventes, il reste ${fr(v)} € une fois payés les coûts de l'activité (marge opérationnelle). Une marge élevée signale souvent un avantage sur les concurrents.${vsSector(share, med, "%")}`)

  const mn = ranked(stock.profitMargins, stats.marginNette, [[0, 0], [2, 3], [6, 5], [12, 7], [18, 10]], (v, share, med) =>
    `Après impôts et intérêts de la dette, il reste ${fr(v)} € de bénéfice net sur 100 € de ventes (marge nette).${vsSector(share, med, "%")}`)

  const finReason = isFin ? "Non comparable pour les banques et assureurs" : null

  return buildPillar([
    { key: "roe", label: "ROE vs secteur", value: stock.returnOnEquity, displayValue: fmtPct(stock.returnOnEquity), note: roe.note, weight: isFin ? 0.60 : 0.30, sectorValues: stats.roe, explanation: roe.explanation },
    { key: "roa", label: "ROA vs secteur", value: stock.returnOnAssets, displayValue: fmtPct(stock.returnOnAssets), note: roa.note, weight: isFin ? 0.40 : 0.15, sectorValues: stats.roa, explanation: roa.explanation },
    { key: "marge_ope", label: "Marge opérationnelle vs secteur", value: stock.operatingMargins, displayValue: fmtPct(stock.operatingMargins), note: mo.note, weight: 0.30, sectorValues: stats.marginOpe, excludedReason: finReason, explanation: mo.explanation },
    { key: "marge_nette", label: "Marge nette vs secteur", value: stock.profitMargins, displayValue: fmtPct(stock.profitMargins), note: mn.note, weight: 0.25, sectorValues: stats.marginNette, excludedReason: finReason, explanation: mn.explanation },
  ])
}

// ─── 3. CROISSANCE ───

function scoreCroissance(stock: Stock): PillarResult {
  const inputs: MetricInput[] = []

  {
    const g = stock.revenueGrowth
    inputs.push({
      key: "croissance_ca", label: "Croissance du chiffre d'affaires (1 an)", value: g, displayValue: g != null ? signedPct(g) : "—",
      note: g != null ? clamp(lerp(g, [[-10, 0], [0, 3], [3, 5], [10, 7], [20, 10]])) : null, weight: 0.35,
      explanation: g == null ? null : g >= 0
        ? `Les ventes ont progressé de ${fr(g)} % sur un an. À titre de repère, 3 % suit à peu près l'inflation, et au-delà de 10 % l'entreprise gagne nettement du terrain.`
        : `Les ventes ont reculé de ${fr(Math.abs(g))} % sur un an : l'activité se contracte.`,
    })
  }

  {
    const g = stock.earningsGrowth
    let note: number | null = null
    if (g != null) {
      note = clamp(lerp(Math.min(g, 500), [[-20, 0], [0, 3], [3, 5], [12, 7], [25, 10]]))
      // Une hausse démesurée vient presque toujours d'une base de comparaison très basse
      if (g > 500) note = Math.min(note, 8)
    }
    inputs.push({
      key: "croissance_bpa", label: "Croissance du bénéfice par action (1 an)", value: g, displayValue: g != null ? signedPct(g) : "—", note, weight: 0.35,
      explanation: g == null ? null : g > 500
        ? `Le bénéfice par action a été multiplié par plus de six en un an. Un tel bond vient en général d'une année précédente très faible : il est plafonné dans la note.`
        : g >= 0
          ? `Le bénéfice par action a augmenté de ${fr(g)} % sur un an. C'est ce chiffre, plus que les ventes, qui finit par faire monter le cours.`
          : `Le bénéfice par action a baissé de ${fr(Math.abs(g))} % sur un an.`,
    })
  }

  {
    const revenues = stock.annualFinancials.slice(-3).map((f) => f.revenue).filter((r): r is number => r != null)
    let note: number | null = null
    let display = "—"
    let explanation: string | null = null
    if (revenues.length >= 3) {
      const up1 = revenues[1] > revenues[0]
      const up2 = revenues[2] > revenues[1]
      if (up1 && up2) {
        const g1 = (revenues[1] - revenues[0]) / Math.abs(revenues[0])
        const g2 = (revenues[2] - revenues[1]) / Math.abs(revenues[1])
        note = g2 > g1 ? 10 : 8
        display = g2 > g1 ? "Hausse qui accélère" : "Hausse régulière"
        explanation = g2 > g1
          ? "Les ventes annuelles ont augmenté deux années de suite, et plus vite la seconde : la croissance s'installe et accélère."
          : "Les ventes annuelles ont augmenté deux années de suite : la croissance n'est pas un accident d'une seule année."
      } else if (up1 || up2) {
        note = 5
        display = "Irrégulière"
        explanation = "Sur les trois derniers exercices, les ventes ont monté une année et baissé l'autre : la trajectoire est irrégulière."
      } else {
        note = 1
        display = "En recul"
        explanation = "Les ventes annuelles ont baissé deux années de suite : le recul est durable, pas ponctuel."
      }
    }
    inputs.push({ key: "tendance_ca_3ans", label: "Tendance des ventes sur 3 ans", value: null, displayValue: display, note, weight: 0.30, explanation })
  }

  return buildPillar(inputs)
}

// ─── 4. SOLIDITÉ FINANCIÈRE ───

function scoreSante(stock: Stock): PillarResult {
  const isFin = isFinancialSector(stock.sector)
  const inputs: MetricInput[] = []

  {
    const de = stock.debtToEquity
    const thresholds: [number, number][] = isRealEstate(stock.sector)
      ? [[0, 10], [50, 8], [100, 6], [200, 5], [350, 3], [500, 1], [700, 0]]
      : [[0, 10], [30, 8], [60, 6], [100, 5], [150, 3], [250, 1], [400, 0]]
    inputs.push({
      key: "debt_equity", label: "Dette / capitaux propres", value: de, displayValue: fmt(de, " %"),
      note: de != null ? clamp(lerp(de, thresholds)) : null, weight: 0.35,
      excludedReason: isFin ? "Non pertinent pour les banques et assureurs (la dette est leur matière première)" : null,
      explanation: de == null ? null
        : `Pour 100 € appartenant aux actionnaires, l'entreprise a emprunté ${fr(de, 0)} €. ${de < 60 ? "L'endettement est faible, ce qui laisse de la marge en cas de coup dur." : de < 150 ? "L'endettement est dans la moyenne." : "L'endettement est lourd : une hausse des taux ou une mauvaise année pèserait vite sur les comptes."}${isRealEstate(stock.sector) ? " Les sociétés immobilières s'endettent structurellement plus, la grille en tient compte." : ""}`,
    })
  }

  {
    const netDebt = stock.totalDebt != null && stock.totalCash != null ? stock.totalDebt - stock.totalCash : null
    const ratio = netDebt != null && stock.marketCap != null && stock.marketCap > 0 ? netDebt / stock.marketCap : null
    inputs.push({
      key: "dette_nette", label: "Dette nette / valeur en Bourse", value: netDebt, displayValue: ratio != null ? `${fr(ratio * 100, 0)} %` : "—",
      note: ratio != null ? clamp(lerp(ratio, [[-0.3, 10], [-0.1, 9], [0, 7], [0.3, 5], [0.6, 3], [1.0, 1], [1.5, 0]])) : null, weight: isFin ? 0.50 : 0.35,
      explanation: ratio == null ? null : ratio < 0
        ? `L'entreprise a plus d'argent en caisse que de dettes : sa trésorerie nette représente ${fr(Math.abs(ratio) * 100, 0)} % de sa valeur en Bourse. C'est un coussin de sécurité.`
        : `Une fois sa trésorerie déduite, la dette restante représente ${fr(ratio * 100, 0)} % de la valeur de l'entreprise en Bourse. ${ratio < 0.3 ? "Le poids de la dette reste modéré." : ratio < 0.6 ? "Le poids de la dette est notable." : "La dette pèse lourd face à la valeur de l'entreprise."}`,
    })
  }

  {
    const recent = stock.annualFinancials.slice(-3).filter((f) => f.netIncome != null)
    const positive = recent.filter((f) => (f.netIncome as number) > 0).length
    const enough = recent.length >= 3
    inputs.push({
      key: "profitabilite_constante", label: "Années bénéficiaires (sur 3)", value: enough ? positive : null,
      displayValue: enough ? `${positive} sur 3` : "—",
      note: enough ? (positive === 3 ? 10 : positive === 2 ? 5 : 1) : null, weight: isFin ? 0.50 : 0.30,
      explanation: !enough ? null : positive === 3
        ? "L'entreprise a gagné de l'argent sur chacun de ses trois derniers exercices : elle finance son activité elle-même."
        : positive === 2
          ? "L'entreprise a terminé une année en perte sur les trois dernières."
          : `L'entreprise a été en perte ${3 - positive} années sur les trois dernières : elle dépend de ses réserves ou de nouveaux financements.`,
    })
  }

  return buildPillar(inputs)
}

// ─── 5. DIVIDENDE ───

/**
 * Dividendes annuels sur des années entières uniquement. L'historique couvre cinq ans glissants :
 * la première année est donc tronquée, et l'année en cours n'est pas terminée. Les comparer aux
 * années pleines faisait apparaître de fausses baisses.
 */
export function completeDividendYears(stock: Stock): { year: number; total: number }[] {
  const currentYear = new Date().getFullYear()
  const firstPriceYear = currentYear - 5
  return stock.dividendHistory.filter((d) => d.year < currentYear && d.year > firstPriceYear)
}

function consecutiveDividendIncreases(years: { year: number; total: number }[]): number {
  let n = 0
  for (let i = years.length - 1; i > 0; i--) {
    if (years[i].total > years[i - 1].total) n++
    else break
  }
  return n
}

function scoreDividende(stock: Stock): PillarResult {
  const dy = stock.dividendYield

  if (dy == null || dy === 0) {
    // Pas de dividende : le critère est sans objet. Il ne compte pas dans la note globale
    // (auparavant il valait 0 et retirait jusqu'à un point aux sociétés qui réinvestissent tout).
    const result = buildPillar([
      { key: "rendement", label: "Rendement", value: 0, displayValue: "0 %", note: null, weight: 1, excludedReason: "L'entreprise ne verse pas de dividende" },
    ])
    return { ...result, score: 0, counted: false }
  }

  const years = completeDividendYears(stock)
  const inputs: MetricInput[] = []

  {
    let note: number
    if (dy >= 3.5 && dy <= 6.0) note = 10
    else if ((dy >= 2.5 && dy < 3.5) || (dy > 6.0 && dy <= 7.5)) note = 7
    else if (dy >= 1.5 && dy < 2.5) note = 5
    else if (dy > 7.5) note = 3
    else if (dy >= 0.5) note = 3
    else note = 1
    inputs.push({
      key: "rendement", label: "Rendement", value: dy, displayValue: fmtPct(dy), note, weight: 0.25,
      explanation: `Au cours actuel, le dividende rapporte ${fr(dy)} % par an. ${dy > 7.5 ? "Un rendement aussi élevé est souvent le signe que le marché doute de son maintien : il est noté avec prudence." : dy >= 3.5 ? "C'est un rendement généreux sans être suspect." : dy >= 2.5 ? "C'est un rendement correct." : dy >= 1.5 ? "C'est un rendement modeste." : "C'est un rendement symbolique."}`,
    })
  }

  {
    const pr = stock.payoutRatio
    let note: number | null = null
    if (pr != null) {
      if (pr >= 30 && pr <= 50) note = 10
      else if ((pr > 50 && pr <= 65) || (pr >= 20 && pr < 30)) note = 7
      else if ((pr > 65 && pr <= 80) || pr < 20) note = 5
      else if (pr > 80 && pr <= 100) note = 3
      else note = 0
    }
    inputs.push({
      key: "payout", label: "Part des bénéfices distribuée", value: pr, displayValue: fmtPct(pr), note, weight: 0.25,
      explanation: pr == null ? null
        : `L'entreprise reverse ${fr(pr, 0)} % de ses bénéfices à ses actionnaires. ${pr > 100 ? "Elle distribue plus qu'elle ne gagne : ce n'est pas tenable longtemps." : pr > 80 ? "Il lui reste peu de marge : une mauvaise année pourrait forcer une baisse du dividende." : pr >= 30 ? "Il lui reste de quoi investir et encaisser une mauvaise année sans y toucher." : "Elle garde l'essentiel de ses bénéfices pour se développer."}`,
    })
  }

  {
    const increases = consecutiveDividendIncreases(years)
    const enough = years.length >= 3
    inputs.push({
      key: "historique", label: "Hausses consécutives du dividende", value: enough ? increases : null,
      displayValue: enough ? `${increases} an${increases > 1 ? "s" : ""}` : "—",
      note: enough ? (increases >= 3 ? 10 : increases === 2 ? 7 : increases === 1 ? 4 : 1) : null, weight: 0.25,
      explanation: !enough ? null : increases === 0
        ? `Le dividende de ${years[years.length - 1].year} n'a pas augmenté par rapport à l'année précédente.`
        : `Le dividende a été relevé ${increases} année${increases > 1 ? "s" : ""} de suite (années entières ${years[0].year} à ${years[years.length - 1].year}). Une hausse régulière montre que la direction a confiance dans ses bénéfices futurs.`,
    })
  }

  {
    let note: number | null = null
    let display = "—"
    let explanation: string | null = null
    if (years.length >= 2) {
      const first = years[0].total
      const last = years[years.length - 1].total
      const span = years[years.length - 1].year - years[0].year
      if (first > 0 && last > 0 && span > 0) {
        const cagr = (Math.pow(last / first, 1 / span) - 1) * 100
        note = clamp(lerp(cagr, [[-5, 0], [0, 3], [3, 5], [6, 7], [10, 10]]))
        display = `${signedPct(cagr)} par an`
        explanation = cagr >= 0
          ? `Entre ${years[0].year} et ${years[years.length - 1].year}, le dividende a progressé de ${fr(cagr)} % par an en moyenne.${cagr > 3 ? " C'est plus vite que l'inflation habituelle : il fait gagner du pouvoir d'achat." : ""}`
          : `Entre ${years[0].year} et ${years[years.length - 1].year}, le dividende a baissé de ${fr(Math.abs(cagr))} % par an en moyenne.`
      }
    }
    inputs.push({ key: "croissance_div", label: "Progression annuelle du dividende", value: null, displayValue: display, note, weight: 0.25, explanation })
  }

  const result = buildPillar(inputs)
  let score = result.score

  // Rendement très élevé et bénéfices presque entièrement distribués : dividende à risque
  if (dy > 8 && stock.payoutRatio != null && stock.payoutRatio > 90) score = Math.max(0, score - 2)
  // Dividende réduit de plus de 20 % sur la dernière année entière : la note est plafonnée
  if (years.length >= 2 && years[years.length - 1].total < years[years.length - 2].total * 0.8) score = Math.min(score, 3)

  return { ...result, score: clamp(score) }
}

// ─── 6. TENDANCE DU COURS ───

function scoreMomentum(stock: Stock): PillarResult {
  const inputs: MetricInput[] = []

  {
    const v = stock.priceVsSma200
    inputs.push({
      key: "vs_sma200", label: "Cours vs moyenne 200 jours", value: v, displayValue: v != null ? signedPct(v) : "—",
      note: v != null ? clamp(lerp(v, [[-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10]])) : null, weight: 0.30,
      explanation: v == null ? null : v >= 0
        ? `Le cours est ${fr(v)} % au-dessus de sa moyenne des 200 dernières séances (environ dix mois) : la tendance de fond est à la hausse.`
        : `Le cours est ${fr(Math.abs(v))} % sous sa moyenne des 200 dernières séances (environ dix mois) : la tendance de fond est à la baisse.`,
    })
  }

  {
    const has = stock.sma50 != null && stock.sma200 != null && stock.sma200 !== 0
    const gap = has ? ((stock.sma50! - stock.sma200!) / stock.sma200!) * 100 : null
    inputs.push({
      key: "cross", label: "Moyenne 50 jours vs 200 jours", value: gap, displayValue: gap != null ? (gap > 0 ? "Haussier" : "Baissier") : "—",
      note: gap != null ? clamp(lerp(gap, [[-10, 0], [-3, 2], [0, 5], [3, 8], [10, 10]])) : null, weight: 0.20,
      explanation: gap == null ? null : gap > 0
        ? "La moyenne des deux derniers mois est au-dessus de celle des dix derniers : la hausse récente confirme la tendance longue."
        : "La moyenne des deux derniers mois est passée sous celle des dix derniers : la faiblesse récente s'installe.",
    })
  }

  {
    const rsi = stock.rsi14
    let note: number | null = null
    if (rsi != null) {
      if (rsi >= 50 && rsi <= 65) note = 10
      else if ((rsi >= 40 && rsi < 50) || (rsi > 65 && rsi <= 70)) note = 7
      else if (rsi >= 30 && rsi < 40) note = 5
      else if (rsi > 70 && rsi <= 80) note = 3
      else note = 0
    }
    inputs.push({
      key: "rsi", label: "RSI (14 jours)", value: rsi, displayValue: rsi != null ? fr(rsi, 0) : "—", note, weight: 0.25,
      explanation: rsi == null ? null
        : `Le RSI mesure, de 0 à 100, si les dernières séances ont été dominées par les achats ou par les ventes. Il est à ${fr(rsi, 0)} : ${rsi > 70 ? "l'action a beaucoup monté très vite, une pause ou un repli est fréquent après un tel niveau." : rsi >= 50 ? "les acheteurs dominent sans excès, la configuration la plus saine." : rsi >= 30 ? "les vendeurs dominent légèrement." : "l'action a été massivement vendue. Cela peut précéder un rebond, mais aussi traduire un vrai problème."}`,
    })
  }

  {
    const v = stock.perf6M
    inputs.push({
      key: "perf_6m", label: "Performance sur 6 mois", value: v, displayValue: v != null ? signedPct(v) : "—",
      note: v != null ? clamp(lerp(v, [[-15, 0], [-5, 3], [0, 5], [5, 7], [15, 10]])) : null, weight: 0.25,
      explanation: v == null ? null
        : `Le cours a ${v >= 0 ? "gagné" : "perdu"} ${fr(Math.abs(v))} % en six mois. Les études montrent que les actions qui montent depuis plusieurs mois continuent en moyenne sur leur lancée quelque temps, et inversement.`,
    })
  }

  return buildPillar(inputs)
}

// ─── 7. SIGNAUX COMPLÉMENTAIRES ───
// Si un score de modèle statistique existe pour l'action, il est utilisé seul.
// Sinon : distance au plus haut annuel et tendance des bénéfices.

function scoreQuant(stock: Stock): PillarResult {
  if (stock.mlScore != null) {
    return buildPillar([{
      key: "ml_signal", label: "Score du modèle statistique", value: stock.mlScore, displayValue: `${fr(stock.mlScore)} / 10`,
      note: clamp(stock.mlScore), weight: 1,
      explanation: `Un modèle statistique entraîné sur les comptes publiés par les sociétés américaines classe cette action à ${fr(stock.mlScore)} sur 10 parmi son univers.`,
    }])
  }

  const inputs: MetricInput[] = []

  {
    const dist = stock.fiftyTwoWeekHigh != null && stock.price != null && stock.fiftyTwoWeekHigh > 0
      ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 : null
    inputs.push({
      key: "distance_ath", label: "Écart au plus haut sur 1 an", value: dist, displayValue: dist != null ? `−${fr(dist)} %` : "—",
      note: dist != null ? clamp(lerp(dist, [[5, 10], [10, 7], [20, 5], [40, 3], [60, 0]])) : null, weight: 0.45,
      explanation: dist == null ? null : dist < 10
        ? `Le cours est à ${fr(dist)} % de son plus haut des douze derniers mois : le marché valide le parcours de l'entreprise.`
        : `Le cours est ${fr(dist)} % sous son plus haut des douze derniers mois. ${dist > 40 ? "Une telle chute traduit en général une vraie déception, pas seulement une occasion." : "L'action a perdu de son élan."}`,
    })
  }

  {
    const incomes = stock.annualFinancials.slice(-3).map((f) => f.netIncome).filter((n): n is number => n != null)
    let note: number | null = null
    let display = "—"
    let explanation: string | null = null
    if (incomes.length >= 3) {
      const ups = (incomes[1] > incomes[0] ? 1 : 0) + (incomes[2] > incomes[1] ? 1 : 0)
      note = ups === 2 ? 9 : ups === 1 ? 5 : 2
      display = `${ups} hausse${ups > 1 ? "s" : ""} sur 2`
      explanation = ups === 2
        ? "Le bénéfice annuel a augmenté deux exercices de suite."
        : ups === 1
          ? "Le bénéfice annuel a augmenté une année et baissé l'autre sur les trois derniers exercices."
          : "Le bénéfice annuel a baissé deux exercices de suite."
    }
    inputs.push({ key: "tendance_resultats", label: "Tendance du bénéfice sur 3 ans", value: null, displayValue: display, note, weight: 0.55, explanation })
  }

  return buildPillar(inputs)
}

// ─── Textes pédagogiques par critère ───

const PILLAR_INFO: Record<PillarKey, { title: string; question: string; levels: [string, string, string] }> = {
  valorisation: {
    title: "Valorisation",
    question: "L'action est-elle chère ou bon marché par rapport à ce que l'entreprise gagne, encaisse et possède ? Une excellente société peut être un mauvais achat si on la paie trop cher.",
    levels: ["L'action est bon marché par rapport aux sociétés comparables.", "L'action est à un prix dans la moyenne de son secteur.", "L'action est chère par rapport aux sociétés comparables."],
  },
  qualite: {
    title: "Rentabilité",
    question: "L'entreprise transforme-t-elle efficacement ses ventes et l'argent de ses actionnaires en bénéfices ? C'est le meilleur indice d'un avantage durable sur ses concurrents.",
    levels: ["L'entreprise est plus rentable que la plupart de ses concurrentes.", "La rentabilité est dans la moyenne du secteur.", "L'entreprise est moins rentable que la plupart de ses concurrentes."],
  },
  croissance: {
    title: "Croissance",
    question: "Les ventes et les bénéfices augmentent-ils, et de façon régulière ? Sur la durée, le cours d'une action suit la progression de ses bénéfices.",
    levels: ["L'activité et les bénéfices progressent nettement.", "La croissance est modérée ou irrégulière.", "L'activité stagne ou recule."],
  },
  sante: {
    title: "Solidité financière",
    question: "L'entreprise pourrait-elle traverser une mauvaise passe sans mettre ses actionnaires en danger ? On regarde le poids de sa dette et la régularité de ses bénéfices.",
    levels: ["Le bilan est solide : peu de dette et des bénéfices réguliers.", "Le bilan est correct, sans marge de sécurité particulière.", "Le bilan est fragile : dette lourde ou pertes récentes."],
  },
  dividende: {
    title: "Dividende",
    question: "Le dividende est-il intéressant et, surtout, a-t-il des chances d'être maintenu ? Un gros rendement ne vaut rien s'il est coupé l'année suivante.",
    levels: ["Le dividende est attractif et paraît tenable.", "Le dividende est modeste ou sa progression est irrégulière.", "Le dividende est faible ou paraît fragile."],
  },
  momentum: {
    title: "Tendance du cours",
    question: "Le marché pousse-t-il l'action à la hausse ou à la baisse en ce moment ? Ce critère ne dit rien de l'entreprise elle-même, mais aide à ne pas acheter en pleine chute.",
    levels: ["Le cours est bien orienté.", "Le cours n'a pas de direction nette.", "Le cours est orienté à la baisse."],
  },
  quant: {
    title: "Signaux complémentaires",
    question: "Deux indices supplémentaires vont-ils dans le même sens : le cours tient-il près de ses sommets, et les bénéfices montent-ils d'année en année ?",
    levels: ["Les signaux complémentaires sont favorables.", "Les signaux complémentaires sont mitigés.", "Les signaux complémentaires sont défavorables."],
  },
}

/** Présentation des critères pour la page Méthodologie : nom, poids de base et question posée. */
export function getPillarCatalog(): { key: PillarKey; title: string; question: string; weight: number }[] {
  return (Object.keys(PILLAR_INFO) as PillarKey[]).map((key) => ({
    key, title: PILLAR_INFO[key].title, question: PILLAR_INFO[key].question, weight: BASE_WEIGHTS[key],
  }))
}

/** En dessous de cette part de données disponibles, la note est rapprochée de la moyenne. */
const FULL_CONFIDENCE_COVERAGE = 0.8

const BASE_WEIGHTS: Record<PillarKey, number> = {
  valorisation: 0.20, qualite: 0.20, croissance: 0.15, sante: 0.15, dividende: 0.10, momentum: 0.10, quant: 0.10,
}

function explainPillar(key: PillarKey, result: PillarResult): PillarExplanation {
  const info = PILLAR_INFO[key]
  const points = Object.values(result.detail).map((m) => m.explanation).filter((e): e is string => e != null)
  let verdict: string
  if (!result.counted) {
    verdict = key === "dividende"
      ? "L'entreprise ne verse pas de dividende. Ce n'est ni bon ni mauvais en soi : beaucoup de sociétés en croissance préfèrent réinvestir leurs bénéfices. Ce critère ne compte donc pas dans la note."
      : "Aucune donnée n'est disponible pour ce critère : il ne compte pas dans la note."
  } else {
    const rounded = Math.round(result.score * 10) / 10
    verdict = rounded >= 7 ? info.levels[0] : rounded >= 4.5 ? info.levels[1] : info.levels[2]
    if (result.coverage < 0.6) verdict += " Attention, une partie des chiffres manque : cette note repose sur des données partielles."
  }
  return { title: info.title, question: info.question, verdict, points, counted: result.counted, coverage: result.coverage }
}

// ─── FLAG CATALOG (for filter UI) ───

export const FLAG_CATALOG: { id: FlagId; label: string; emoji: string; type: FlagType; description: string }[] = [
  { id: "dividend_aristocrat", label: "Dividende croissant", emoji: "👑", type: "positive", description: "Dividende relevé chaque année sur les années entières disponibles (quatre au plus), moins de 80 % des bénéfices distribués, rendement supérieur à 1,5 %." },
  { id: "cash_machine", label: "Trésorerie nette", emoji: "💰", type: "positive", description: "Plus d'argent en caisse que de dettes, et un endettement inférieur à 50 % des capitaux propres." },
  { id: "golden_cross", label: "Croisement haussier", emoji: "✨", type: "positive", description: "La moyenne du cours sur 50 séances est réellement passée au-dessus de celle sur 200 séances dans les 20 dernières séances." },
  { id: "consensus_up", label: "Bénéfices attendus ↗", emoji: "📈", type: "positive", description: "Rapporté aux bénéfices attendus par les analystes, le PER baisse de plus de 40 %. Ce sont des prévisions, pas des révisions constatées." },
  { id: "turnaround", label: "Retournement", emoji: "🔄", type: "positive", description: "Bénéfices en hausse de plus de 30 %, alors que le cours a baissé sur six mois." },
  { id: "value_trap", label: "Dividende à risque", emoji: "⚠️", type: "negative", description: "Rendement supérieur à 7 % accompagné d'au moins un signe de fragilité : bénéfices presque entièrement distribués, ventes en recul ou dette élevée." },
  { id: "death_cross", label: "Croisement baissier", emoji: "💀", type: "negative", description: "La moyenne du cours sur 50 séances est réellement passée sous celle sur 200 séances dans les 20 dernières séances." },
  { id: "oversold", label: "Survendu", emoji: "📉", type: "negative", description: "Action massivement vendue (RSI inférieur à 25) et plus de 30 % sous son plus haut annuel. Un rebond est possible, mais la chute a souvent une cause." },
  { id: "overbought", label: "Surachat", emoji: "🔥", type: "negative", description: "Hausse de plus de 20 % en un mois avec un RSI supérieur à 80 : un repli à court terme est fréquent." },
  { id: "fragile_balance", label: "Bilan fragile", emoji: "🏚️", type: "negative", description: "Dette supérieure à deux fois et demie les capitaux propres (hors finance et immobilier)." },
]

const flagLabel = (id: FlagId) => FLAG_CATALOG.find((f) => f.id === id)!

/** Un croisement de moyennes n'est signalé que s'il a réellement eu lieu dans cette fenêtre (séances). */
const CROSS_WINDOW_DAYS = 20

function detectFlags(stock: Stock, stats: SectorStats): StockFlag[] {
  const flags: StockFlag[] = []
  const medPe = computeMedian(stats.pe)
  const push = (id: FlagId, color: string, detail: string, priority: number) => {
    const f = flagLabel(id)
    flags.push({ id, type: f.type, label: f.label, emoji: f.emoji, color, detail, priority })
  }

  // 1. Dividende croissant : relevé chaque année sur toutes les années entières disponibles
  const divYears = completeDividendYears(stock)
  const increases = consecutiveDividendIncreases(divYears)
  if (
    divYears.length >= 4 && increases === divYears.length - 1 &&
    stock.payoutRatio != null && stock.payoutRatio < 80 &&
    stock.dividendYield != null && stock.dividendYield > 1.5
  ) {
    push("dividend_aristocrat", "text-yellow-600 dark:text-yellow-400",
      `Dividende relevé chaque année de ${divYears[0].year} à ${divYears[divYears.length - 1].year}, avec ${fr(stock.payoutRatio, 0)} % des bénéfices distribués. L'historique disponible est trop court pour parler d'« aristocrate » (25 ans de hausse).`, 1)
  }

  // 2. Trésorerie nette positive
  if (
    stock.totalDebt != null && stock.totalCash != null && stock.totalCash > stock.totalDebt &&
    stock.debtToEquity != null && stock.debtToEquity < 50
  ) {
    push("cash_machine", "text-emerald-600 dark:text-emerald-400",
      "L'entreprise a plus d'argent en caisse que de dettes. Elle peut investir ou traverser une crise sans dépendre des banques.", 2)
  }

  // 3 et 7. Croisement des moyennes mobiles, uniquement s'il vient réellement de se produire
  const cross = stock.smaCross
  if (cross && cross.daysAgo <= CROSS_WINDOW_DAYS) {
    const when = cross.daysAgo === 0 ? "aujourd'hui" : `il y a ${cross.daysAgo} séance${cross.daysAgo > 1 ? "s" : ""}`
    if (cross.type === "golden") {
      push("golden_cross", "text-emerald-600 dark:text-emerald-400",
        `La moyenne des 50 dernières séances est passée au-dessus de celle des 200 dernières ${when}. Les analystes techniques y voient le début possible d'une tendance haussière.`, 3)
    } else {
      push("death_cross", "text-red-600 dark:text-red-400",
        `La moyenne des 50 dernières séances est passée sous celle des 200 dernières ${when}. Les analystes techniques y voient le début possible d'une tendance baissière.`, 1)
    }
  }

  // 4. Bénéfices attendus en nette hausse (ce ne sont pas des révisions d'analystes)
  if (stock.forwardPE != null && stock.trailingPE != null && stock.trailingPE > 0 && stock.forwardPE > 0) {
    const improvement = ((stock.trailingPE - stock.forwardPE) / stock.trailingPE) * 100
    if (improvement > 40) {
      push("consensus_up", "text-emerald-600 dark:text-emerald-400",
        `Les analystes attendent des bénéfices nettement supérieurs l'an prochain : rapporté à ces prévisions, le PER baisse de ${fr(improvement, 0)} %. Ce sont des prévisions, qui peuvent être déçues.`, 3)
    }
  }

  // 5. Retournement
  if (
    stock.earningsGrowth != null && stock.earningsGrowth > 30 &&
    stock.trailingPE != null && medPe != null && stock.trailingPE > medPe * 1.3 &&
    stock.perf6M != null && stock.perf6M < 0
  ) {
    push("turnaround", "text-blue-600 dark:text-blue-400",
      "Les bénéfices repartent fortement à la hausse alors que le cours a baissé sur six mois : le marché n'a pas encore suivi.", 4)
  }

  // 6. Dividende à risque
  if (stock.dividendYield != null && stock.dividendYield > 7) {
    const reasons: string[] = []
    if (stock.payoutRatio != null && stock.payoutRatio > 90) reasons.push("presque tous les bénéfices sont distribués")
    if (stock.revenueGrowth != null && stock.revenueGrowth < -5) reasons.push("les ventes reculent")
    if (stock.debtToEquity != null && stock.debtToEquity > 200) reasons.push("la dette est élevée")
    if (reasons.length > 0) {
      push("value_trap", "text-red-600 dark:text-red-400",
        `Rendement de ${fr(stock.dividendYield)} %, mais ${reasons.join(" et ")}. Un rendement aussi élevé annonce souvent une baisse du dividende.`, 0)
    }
  }

  // 8. Survendu
  if (
    stock.rsi14 != null && stock.rsi14 < 25 &&
    stock.fiftyTwoWeekHigh != null && stock.price != null &&
    ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100 > 30
  ) {
    const drop = ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100
    push("oversold", "text-orange-600 dark:text-orange-400",
      `L'action a été massivement vendue (RSI à ${fr(stock.rsi14, 0)}) et cote ${fr(drop, 0)} % sous son plus haut annuel. Un rebond est possible, mais la chute a souvent une raison : à vérifier avant d'y voir une occasion.`, 2)
  }

  // 9. Surachat
  if (stock.rsi14 != null && stock.rsi14 > 80 && stock.perf1M != null && stock.perf1M > 20) {
    push("overbought", "text-orange-600 dark:text-orange-400",
      `L'action a pris ${fr(stock.perf1M, 0)} % en un mois (RSI à ${fr(stock.rsi14, 0)}). Après une hausse aussi rapide, un repli à court terme est fréquent.`, 2)
  }

  // 10. Bilan fragile
  if (stock.debtToEquity != null && stock.debtToEquity > 250 && !isFinancialSector(stock.sector) && !isRealEstate(stock.sector)) {
    push("fragile_balance", "text-red-600 dark:text-red-400",
      `L'entreprise a emprunté ${fr(stock.debtToEquity, 0)} € pour 100 € de capitaux propres. Elle est vulnérable à une hausse des taux ou à un ralentissement.`, 1)
  }

  flags.sort((a, b) => {
    if (a.type !== b.type) return a.type === "negative" ? -1 : 1
    return a.priority - b.priority
  })

  return flags
}

// ─── Synthèse ───

function generateVerdict(pillars: StockScore["pillars"], counted: Record<PillarKey, boolean>): string {
  const phrases: string[] = []
  const has = (k: PillarKey) => counted[k]

  if (has("valorisation")) {
    if (pillars.valorisation >= 8.0) phrases.push("Prix très attractif")
    else if (pillars.valorisation >= 7.0) phrases.push("Prix attractif")
    else if (pillars.valorisation <= 3.0) phrases.push("Prix élevé")
  }
  if (has("qualite")) {
    if (pillars.qualite >= 8.0) phrases.push("rentabilité élevée")
    else if (pillars.qualite <= 3.0) phrases.push("rentabilité faible")
  }
  if (has("croissance")) {
    if (pillars.croissance >= 8.0) phrases.push("forte croissance")
    else if (pillars.croissance <= 3.0) phrases.push("activité en recul")
  }
  if (has("sante")) {
    if (pillars.sante >= 8.0) phrases.push("bilan solide")
    else if (pillars.sante <= 3.0) phrases.push("bilan fragile")
  }
  if (has("dividende")) {
    if (pillars.dividende >= 8.0) phrases.push("dividende de qualité")
    else if (pillars.dividende <= 2.0) phrases.push("dividende fragile")
  }
  if (has("momentum")) {
    if (pillars.momentum >= 8.0) phrases.push("cours bien orienté")
    else if (pillars.momentum <= 3.0) phrases.push("cours en baisse")
  }

  if (phrases.length === 0) return "Profil équilibré, sans point fort ni point faible marqué."
  phrases[0] = phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1)
  return phrases.join(", ") + "."
}

/** Les chiffres qui pèsent le plus dans la note, dans un sens ou dans l'autre. */
function pickHighlights(
  results: Record<PillarKey, PillarResult>,
  weights: Record<PillarKey, number>,
  flags: StockFlag[],
): { strengths: string[]; watchPoints: string[] } {
  const candidates: { text: string; impact: number }[] = []
  for (const key of Object.keys(results) as PillarKey[]) {
    if (!results[key].counted) continue
    for (const m of Object.values(results[key].detail)) {
      if (m.excluded || m.missing || !m.explanation) continue
      // Écart à la note moyenne, pondéré par le poids réel du chiffre dans la note globale
      candidates.push({ text: m.explanation, impact: (m.note - 5) * m.weight * weights[key] })
    }
  }
  const strengths = candidates.filter((c) => c.impact > 0.05).sort((a, b) => b.impact - a.impact).slice(0, 3).map((c) => c.text)
  const negatives = flags.filter((f) => f.type === "negative").map((f) => f.detail)
  const weak = candidates.filter((c) => c.impact < -0.05).sort((a, b) => a.impact - b.impact).map((c) => c.text)
  const watchPoints = [...negatives, ...weak].slice(0, 3)
  return { strengths, watchPoints }
}

// ─── MAIN ───

// Regional stats cache: one SectorStats map per region (eu/us/asia)
let cachedRegionalStats: Map<StockRegion, Map<string, SectorStats>> | null = null
let cachedUniverseRef: Stock[] | null = null
let scoreCache = new Map<string, StockScore>()

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
    scoreCache = new Map()
  }
  // Plusieurs écrans notent les mêmes actions : chaque note n'est calculée qu'une fois par jeu de données
  const cached = scoreCache.get(stock.ticker)
  if (cached) return cached

  const region = getStockRegion(stock)
  const sector = stock.sector ?? "Unknown"
  const stats = cachedRegionalStats!.get(region)!.get(sector) ?? EMPTY_STATS

  const results: Record<PillarKey, PillarResult> = {
    valorisation: scoreValorisation(stock, stats),
    qualite: scoreQualite(stock, stats),
    croissance: scoreCroissance(stock),
    sante: scoreSante(stock),
    dividende: scoreDividende(stock),
    momentum: scoreMomentum(stock),
    quant: scoreQuant(stock),
  }
  const keys = Object.keys(results) as PillarKey[]

  const round1 = (v: number) => Math.round(v * 10) / 10
  const pillars = Object.fromEntries(keys.map((k) => [k, round1(results[k].score)])) as Record<PillarKey, number>
  const counted = Object.fromEntries(keys.map((k) => [k, results[k].counted])) as Record<PillarKey, boolean>

  // Les critères sans objet ou sans donnée sont retirés, et leur poids réparti sur les autres
  const totalWeight = keys.reduce((sum, k) => sum + (counted[k] ? BASE_WEIGHTS[k] : 0), 0)
  const weights = Object.fromEntries(
    keys.map((k) => [k, counted[k] && totalWeight > 0 ? BASE_WEIGHTS[k] / totalWeight : 0]),
  ) as Record<PillarKey, number>
  const rawTotal = totalWeight > 0 ? clamp(keys.reduce((sum, k) => sum + pillars[k] * weights[k], 0)) : 5

  // Part des données attendues réellement disponibles. Un critère sans aucune donnée compte pour zéro ;
  // seul le dividende d'une société qui n'en verse pas est « sans objet » et sort du calcul.
  const expected = keys.filter((k) => !(k === "dividende" && !counted[k]))
  const dataCoverage = expected.reduce((sum, k) => sum + BASE_WEIGHTS[k] * results[k].coverage, 0)
    / expected.reduce((sum, k) => sum + BASE_WEIGHTS[k], 0)

  // Avec peu de données, quelques bons chiffres suffiraient à hisser une action en tête du classement :
  // la note est alors ramenée vers la moyenne, d'autant plus qu'il manque de données.
  const confidence = Math.min(1, dataCoverage / FULL_CONFIDENCE_COVERAGE)
  const total = round1(5 + (rawTotal - 5) * confidence)

  const flags = detectFlags(stock, stats)
  const grade = getGrade(total)
  const { strengths, watchPoints } = pickHighlights(results, weights, flags)
  if (confidence < 1) {
    watchPoints.unshift(`Seulement ${Math.round(dataCoverage * 100)} % des chiffres nécessaires sont disponibles pour cette action : la note est moins fiable et a été rapprochée de la moyenne.`)
    watchPoints.splice(3)
  }

  const score: StockScore = {
    total,
    label: grade.label,
    labelColor: grade.color,
    pillars,
    details: Object.fromEntries(keys.map((k) => [k, results[k].detail])) as Record<PillarKey, PillarDetail>,
    explanations: Object.fromEntries(keys.map((k) => [k, explainPillar(k, results[k])])) as Record<PillarKey, PillarExplanation>,
    weights,
    strengths,
    watchPoints,
    dataCoverage,
    sectorContext: { name: sector, count: stats.count, isSmall: stats.count < MIN_SECTOR_SAMPLE },
    flags,
    summary: generateVerdict(pillars, counted),
  }
  scoreCache.set(stock.ticker, score)
  return score
}
