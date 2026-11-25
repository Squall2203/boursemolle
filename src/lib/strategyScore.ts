import type { PillarKey, StockScore } from "./scoring"

/** Les six critères qu'une stratégie de sélection peut pondérer (les signaux complémentaires n'en font pas partie). */
export type StrategyPillar = Exclude<PillarKey, "quant">
export type StrategyWeights = Record<StrategyPillar, number>

export interface StrategyScore {
  /** Note de l'action pour cette stratégie, sur 10 */
  score: number
  /** Notes des critères, identiques à celles de la fiche de l'action */
  pillars: Record<StrategyPillar, number>
  /** Note générale de l'action sur le site */
  globalScore: number
  justification: string
}

/** Part minimale du poids de la stratégie qui doit reposer sur des critères réellement notés */
const MIN_COUNTED_WEIGHT = 0.6
/** En dessous de cette part de données disponibles, la note est rapprochée de la moyenne (comme sur le site) */
const FULL_CONFIDENCE_COVERAGE = 0.8

/**
 * Note d'une action pour une stratégie : les mêmes notes de critères que sur sa fiche, pondérées
 * selon l'objectif de la stratégie. Une seule façon de noter, quel que soit l'endroit du site.
 * Renvoie null si trop de critères de la stratégie sont sans donnée pour cette action.
 */
export function strategyScore(score: StockScore, weights: StrategyWeights): StrategyScore | null {
  const keys = Object.keys(weights) as StrategyPillar[]
  const total = keys.reduce((sum, k) => sum + weights[k], 0)
  const counted = keys.filter((k) => weights[k] > 0 && score.explanations[k].counted)
  const countedWeight = counted.reduce((sum, k) => sum + weights[k], 0)
  if (total <= 0 || countedWeight / total < MIN_COUNTED_WEIGHT) return null

  const raw = counted.reduce((sum, k) => sum + score.pillars[k] * weights[k], 0) / countedWeight
  const confidence = Math.min(1, score.dataCoverage / FULL_CONFIDENCE_COVERAGE)
  const value = 5 + (raw - 5) * confidence

  const parts = score.strengths.slice(0, 2)
  if (score.watchPoints.length > 0) parts.push(`À surveiller : ${score.watchPoints[0]}`)

  return {
    score: Math.round(value * 10) / 10,
    pillars: Object.fromEntries(keys.map((k) => [k, score.pillars[k]])) as Record<StrategyPillar, number>,
    globalScore: score.total,
    justification: parts.length > 0 ? parts.join(" ") : score.summary,
  }
}
