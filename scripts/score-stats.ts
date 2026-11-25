/**
 * Mesures communes aux évaluations des notes : lien entre la note et le rendement qui a suivi,
 * écart entre les mieux et les moins bien notées, décompte des périodes réellement distinctes.
 */
import type { PillarKey } from "../src/lib/scoring.ts"

export const PILLARS: PillarKey[] = ["valorisation", "qualite", "croissance", "sante", "dividende", "momentum", "quant"]

/** En dessous de ce nombre d'actions notées, une date n'est pas exploitable */
const MIN_NAMES = 50

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k][1]] = rank
    i = j + 1
  }
  return out
}

/** Corrélation de rang (Spearman) : +1 si l'ordre des notes est exactement celui des rendements, 0 si aucun lien. */
export function rankCorrelation(a: number[], b: number[]): number | null {
  if (a.length < 10) return null
  const ra = ranks(a), rb = ranks(b)
  const mean = (a.length + 1) / 2
  let num = 0, da = 0, db = 0
  for (let i = 0; i < a.length; i++) {
    num += (ra[i] - mean) * (rb[i] - mean)
    da += (ra[i] - mean) ** 2
    db += (rb[i] - mean) ** 2
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null
}

export const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)
export const median = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

export interface Row { total: number; pillars: Record<PillarKey, number>; counted: Record<PillarKey, boolean>; ret: number }

export interface DateResult {
  date: string
  n: number
  /** Lien entre la note globale et le rendement qui a suivi */
  ic: number
  /** Rendement moyen du cinquième le mieux noté moins celui du cinquième le moins bien noté, en points */
  spread: number
  /** Rendement moyen des actions notées 7 ou plus, moins la moyenne de toutes, en points (null s'il y en a moins de 5) */
  topExcess: number | null
  /** Même chose pour les actions notées moins de 5 */
  bottomExcess: number | null
  pillarIc: Partial<Record<PillarKey, number>>
}

/** Part des rendements les plus extrêmes, de chaque côté, ramenée à la limite */
const WINSOR_SHARE = 0.025

/**
 * Plafonne les rendements extrêmes au niveau du 2,5e et du 97,5e centile de la date.
 * Une très petite société qui triple ou s'effondre suffit sinon à faire basculer une moyenne
 * calculée sur quelques dizaines d'actions, sans rien dire de la qualité des notes.
 */
function winsorize(rows: Row[]): Row[] {
  const sorted = rows.map((r) => r.ret).sort((a, b) => a - b)
  const lo = sorted[Math.floor(sorted.length * WINSOR_SHARE)]
  const hi = sorted[Math.ceil(sorted.length * (1 - WINSOR_SHARE)) - 1]
  return rows.map((r) => ({ ...r, ret: Math.min(hi, Math.max(lo, r.ret)) }))
}

export function evaluateDate(date: string, rawRows: Row[]): DateResult | null {
  if (rawRows.length < MIN_NAMES) return null
  const rows = winsorize(rawRows)
  const rets = rows.map((r) => r.ret)
  const ic = rankCorrelation(rows.map((r) => r.total), rets)
  if (ic == null) return null

  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const fifth = Math.floor(sorted.length / 5)
  const spread = mean(sorted.slice(0, fifth).map((r) => r.ret)) - mean(sorted.slice(-fifth).map((r) => r.ret))

  const all = mean(rets)
  const top = rows.filter((r) => r.total >= 7).map((r) => r.ret)
  const bottom = rows.filter((r) => r.total < 5).map((r) => r.ret)

  const pillarIc: Partial<Record<PillarKey, number>> = {}
  for (const k of PILLARS) {
    const counted = rows.filter((r) => r.counted[k])
    const c = rankCorrelation(counted.map((r) => r.pillars[k]), counted.map((r) => r.ret))
    if (c != null) pillarIc[k] = round(c, 3)
  }

  return {
    date, n: rows.length, ic: round(ic, 3), spread: round(spread),
    topExcess: top.length >= 5 ? round(mean(top) - all) : null,
    bottomExcess: bottom.length >= 5 ? round(mean(bottom) - all) : null,
    pillarIc,
  }
}

/**
 * Dates dont les périodes de mesure ne se chevauchent pas. Deux dates séparées d'une semaine partagent
 * presque tout leur rendement à trois mois : elles ne valent pas deux confirmations distinctes.
 */
export function independentDates(dates: DateResult[], sessions: number): DateResult[] {
  const gapDays = sessions * 1.45 // séances de Bourse → jours calendaires
  const out: DateResult[] = []
  for (const d of dates) {
    const last = out[out.length - 1]
    if (!last || (Date.parse(d.date) - Date.parse(last.date)) / 86_400_000 >= gapDays) out.push(d)
  }
  return out
}

export function summarize(dates: DateResult[], sessions: number) {
  const indep = independentDates(dates, sessions)
  const ics = dates.map((d) => d.ic)
  const spreads = dates.map((d) => d.spread)
  const tops = dates.map((d) => d.topExcess).filter((v): v is number => v != null)
  const bottoms = dates.map((d) => d.bottomExcess).filter((v): v is number => v != null)
  const pillarIc: Partial<Record<PillarKey, number>> = {}
  for (const k of PILLARS) {
    const v = dates.map((d) => d.pillarIc[k]).filter((x): x is number => x != null)
    if (v.length) pillarIc[k] = round(mean(v), 3)
  }
  return {
    nDates: dates.length,
    independent: {
      n: indep.length,
      icPositive: indep.filter((d) => d.ic > 0).length,
      spreadPositive: indep.filter((d) => d.spread > 0).length,
      meanIc: round(mean(indep.map((d) => d.ic)), 3),
    },
    firstDate: dates[0]?.date ?? null,
    lastDate: dates[dates.length - 1]?.date ?? null,
    avgNames: Math.round(mean(dates.map((d) => d.n))),
    meanIc: round(mean(ics), 3),
    datesIcPositive: ics.filter((v) => v > 0).length,
    medianSpread: round(median(spreads)),
    datesSpreadPositive: spreads.filter((v) => v > 0).length,
    meanTopExcess: tops.length ? round(mean(tops)) : null,
    meanBottomExcess: bottoms.length ? round(mean(bottoms)) : null,
    pillarIc,
  }
}

