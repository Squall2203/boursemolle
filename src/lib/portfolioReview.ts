import type { Stock } from "../types/stock"
import { sectorLabel } from "./sectors"

/** Ce dont le bilan a besoin pour chaque ligne du portefeuille */
export interface ReviewPosition {
  ticker: string
  valueEur: number
  stock: Stock | undefined
  /** Note générale de l'action sur le site, si elle est connue */
  score: number | null
}

export interface BenchmarkPoint { date: string; close: number }

export interface ReviewInput {
  positions: ReviewPosition[]
  cashBalance: number
  initialCapital: number
  /** Date de création du portefeuille (ou de sa dernière remise à zéro) */
  since: string
  benchmark?: { name: string; points: BenchmarkPoint[] } | null
  today?: Date
}

export type FindingTone = "good" | "warn" | "info"

export interface Finding {
  id: string
  tone: FindingTone
  title: string
  text: string
}

export interface PortfolioReview {
  findings: Finding[]
  /** Répartition de la partie investie, du secteur le plus lourd au plus léger (en %) */
  sectors: { label: string; weight: number }[]
  performancePct: number
  benchmarkPct: number | null
}

const fr = (v: number, digits = 1) => v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits })
const eur = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
// Une variation infime s'écrit « 0 % », pas « −0 % »
const signed = (v: number) => (Math.abs(v) < 0.05 ? "0 %" : `${v > 0 ? "+" : "−"}${fr(Math.abs(v))} %`)

/** Variation de l'indice entre deux dates, en %, ou null si l'historique ne couvre pas la période. */
export function benchmarkReturn(points: BenchmarkPoint[], since: string, until: string): number | null {
  const start = points.find((p) => p.date >= since.slice(0, 10))
  const end = [...points].reverse().find((p) => p.date <= until.slice(0, 10))
  if (!start || !end || end.date <= start.date || start.close <= 0) return null
  // L'historique doit commencer avant la création du portefeuille, sinon la comparaison est tronquée
  if (points[0].date > since.slice(0, 10)) return null
  return (end.close / start.close - 1) * 100
}

/**
 * Bilan pédagogique d'un portefeuille : ce qu'il a donné face à l'indice, et ce que sa composition
 * implique (concentration, secteurs, devises, qualité des lignes, dividendes attendus).
 * Fonction pure : elle ne lit rien d'autre que ses paramètres.
 */
export function reviewPortfolio(input: ReviewInput): PortfolioReview {
  const today = input.today ?? new Date()
  const positions = input.positions.filter((p) => p.valueEur > 0)
  const invested = positions.reduce((s, p) => s + p.valueEur, 0)
  const total = invested + input.cashBalance
  const findings: Finding[] = []

  // ─── Résultat, comparé à l'indice ───
  const performancePct = input.initialCapital > 0 ? (total / input.initialCapital - 1) * 100 : 0
  const days = Math.max(0, Math.round((today.getTime() - new Date(input.since).getTime()) / 86_400_000))
  const sinceLabel = new Date(input.since).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const benchmarkPct = input.benchmark
    ? benchmarkReturn(input.benchmark.points, input.since, today.toISOString())
    : null

  if (positions.length > 0) {
    if (benchmarkPct != null && input.benchmark) {
      const gap = performancePct - benchmarkPct
      const verdict = Math.abs(gap) < 0.5
        ? "vous faites jeu égal avec lui"
        : gap > 0
          ? `vous avez ${fr(gap)} point${gap >= 2 ? "s" : ""} d'avance`
          : `vous avez ${fr(Math.abs(gap))} point${Math.abs(gap) >= 2 ? "s" : ""} de retard`
      const lesson = days < 180
        ? " Sur une période aussi courte, l'écart tient davantage au hasard qu'au talent : c'est sur plusieurs années qu'une méthode se juge."
        : gap < 0
          ? " Faire mieux que l'indice sur la durée est difficile, y compris pour les professionnels : c'est la raison pour laquelle beaucoup d'épargnants se contentent d'un fonds qui le reproduit."
          : " Regardez d'où vient cette avance : si elle tient à une ou deux lignes, elle peut repartir aussi vite."
      findings.push({
        id: "performance", tone: gap >= 0 ? "good" : "info",
        title: `${signed(performancePct)} depuis le ${sinceLabel}, contre ${signed(benchmarkPct)} pour le ${input.benchmark.name}`,
        text: `Le ${input.benchmark.name} sert de point de comparaison : c'est ce que vous auriez obtenu en achetant simplement le marché français. Sur la même période, ${verdict}.${lesson}`,
      })
    } else {
      findings.push({
        id: "performance", tone: "info",
        title: `${signed(performancePct)} depuis le ${sinceLabel}`,
        text: "Ce chiffre seul ne dit pas si vos choix étaient bons : il faut le comparer à ce qu'a fait le marché sur la même période. La comparaison avec l'indice s'affichera ici dès que son historique sera disponible.",
      })
    }
  }

  // ─── Nombre de lignes ───
  const n = positions.length
  if (n === 0) {
    findings.push({
      id: "vide", tone: "info", title: "Votre portefeuille n'a pas encore de ligne",
      text: "Achetez une première action depuis le screener ou une fiche : ce bilan analysera alors sa composition et la comparera à l'indice.",
    })
    return { findings, sectors: [], performancePct, benchmarkPct }
  }
  findings.push(
    n < 5
      ? { id: "lignes", tone: "warn", title: `${n} ligne${n > 1 ? "s" : ""} seulement`,
          text: "Avec si peu d'actions, une seule mauvaise nouvelle peut emporter une grande partie du portefeuille. Un repère courant est d'en détenir au moins une dizaine, dans des secteurs différents." }
      : n < 10
        ? { id: "lignes", tone: "info", title: `${n} lignes`,
            text: "C'est un début de diversification. Au-delà d'une dizaine de lignes bien réparties, le sort du portefeuille ne dépend plus d'une société en particulier." }
        : { id: "lignes", tone: "good", title: `${n} lignes`,
            text: "Le portefeuille est réparti sur assez de sociétés pour qu'aucune ne décide seule de son sort." },
  )

  // ─── Poids de la plus grosse ligne ───
  const sorted = [...positions].sort((a, b) => b.valueEur - a.valueEur)
  const top = sorted[0]
  const topWeight = (top.valueEur / total) * 100
  const topName = top.stock?.name ?? top.ticker
  if (topWeight > 25) {
    findings.push({ id: "concentration", tone: "warn", title: `${topName} pèse ${fr(topWeight, 0)} % du portefeuille`,
      text: `Si cette action perdait 30 %, l'ensemble du portefeuille reculerait d'environ ${fr(topWeight * 0.3, 0)} % à cause d'elle seule. Beaucoup d'investisseurs se fixent une limite de 10 à 15 % par ligne.` })
  } else if (topWeight > 15) {
    findings.push({ id: "concentration", tone: "info", title: `Votre plus grosse ligne, ${topName}, pèse ${fr(topWeight, 0)} %`,
      text: "C'est un peu au-dessus de la limite de 10 à 15 % par ligne que se fixent beaucoup d'investisseurs. À surveiller si elle continue de grossir." })
  } else {
    findings.push({ id: "concentration", tone: "good", title: `Aucune ligne ne dépasse ${fr(Math.max(topWeight, 1), 0)} %`,
      text: "Aucune action ne pèse assez lourd pour faire basculer le portefeuille à elle seule." })
  }

  // ─── Secteurs (sur la partie investie) ───
  const bySector = new Map<string, number>()
  for (const p of positions) {
    const label = sectorLabel(p.stock?.sector)
    bySector.set(label, (bySector.get(label) ?? 0) + p.valueEur)
  }
  const sectors = [...bySector.entries()]
    .map(([label, value]) => ({ label, weight: (value / invested) * 100 }))
    .sort((a, b) => b.weight - a.weight)
  const mainSector = sectors[0]
  if (mainSector.weight > 40 && n > 1) {
    findings.push({ id: "secteurs", tone: "warn", title: `${fr(mainSector.weight, 0)} % de vos actions sont dans un seul secteur : ${mainSector.label}`,
      text: "Les sociétés d'un même secteur montent et baissent souvent ensemble : une crise du secteur toucherait toutes ces lignes à la fois. Répartir entre des activités différentes amortit ce genre de choc." })
  } else if (sectors.length >= 4) {
    findings.push({ id: "secteurs", tone: "good", title: `${sectors.length} secteurs représentés`,
      text: `Le plus lourd, ${mainSector.label}, pèse ${fr(mainSector.weight, 0)} % de vos actions. Un secteur en difficulté n'entraînerait pas tout le portefeuille.` })
  } else {
    findings.push({ id: "secteurs", tone: "info", title: `${sectors.length} secteur${sectors.length > 1 ? "s" : ""} représenté${sectors.length > 1 ? "s" : ""}`,
      text: "Ajouter des sociétés d'autres activités (santé, industrie, consommation, énergie…) rendrait le portefeuille moins sensible aux difficultés d'un seul métier." })
  }

  // ─── Devises ───
  const foreign = positions.filter((p) => p.stock && p.stock.currency !== "EUR").reduce((s, p) => s + p.valueEur, 0)
  const foreignShare = (foreign / invested) * 100
  if (foreignShare > 30) {
    findings.push({ id: "devises", tone: "info", title: `${fr(foreignShare, 0)} % de vos actions sont cotées dans une autre devise que l'euro`,
      text: "Leur valeur en euros dépend aussi du taux de change : si le dollar baisse de 10 % face à l'euro, une action américaine perd 10 % pour vous même si son cours ne bouge pas. Ces actions ne sont en général pas éligibles au PEA." })
  }

  // ─── Qualité des lignes ───
  const scored = positions.filter((p) => p.score != null)
  if (scored.length > 0) {
    const avg = scored.reduce((s, p) => s + p.score! * p.valueEur, 0) / scored.reduce((s, p) => s + p.valueEur, 0)
    const weak = scored.filter((p) => p.score! < 5).sort((a, b) => a.score! - b.score!)
    if (weak.length > 0) {
      const names = weak.slice(0, 3).map((p) => `${p.stock?.name ?? p.ticker} (${fr(p.score!)})`).join(", ")
      findings.push({ id: "notes", tone: "warn", title: `${weak.length} ligne${weak.length > 1 ? "s" : ""} notée${weak.length > 1 ? "s" : ""} moins de 5 sur 10`,
        text: `${names}${weak.length > 3 ? "…" : ""}. Ouvrez leur fiche pour lire ce qui pèse sur la note : ce n'est pas une raison de vendre à elle seule, mais c'est le moment de vérifier pourquoi vous les détenez. Note moyenne du portefeuille : ${fr(avg)} sur 10.` })
    } else {
      findings.push({ id: "notes", tone: "good", title: `Note moyenne de vos lignes : ${fr(avg)} sur 10`,
        text: "Aucune de vos actions n'est notée en dessous de 5. La note décrit les chiffres actuels de chaque entreprise, pas l'évolution future de son cours." })
    }
  }

  // ─── Dividendes attendus ───
  const dividends = positions.reduce((s, p) => s + p.valueEur * ((p.stock?.dividendYield ?? 0) / 100), 0)
  if (dividends > 0) {
    findings.push({ id: "dividendes", tone: "info", title: `Environ ${eur(dividends)} de dividendes par an`,
      text: `C'est ce que verseraient vos actions sur douze mois si elles maintenaient leur dividende actuel, soit ${fr((dividends / invested) * 100)} % de la somme investie. Aucun dividende n'est garanti.` })
  }

  // ─── Part non investie ───
  const cashShare = (input.cashBalance / total) * 100
  if (cashShare > 50) {
    findings.push({ id: "liquidites", tone: "info", title: `${fr(cashShare, 0)} % du portefeuille n'est pas investi`,
      text: "Garder des liquidités n'est pas une erreur : cela permet d'investir progressivement plutôt que d'un seul coup. Mais tant que cette part reste aussi grande, votre résultat reflète peu vos choix d'actions." })
  }

  return { findings, sectors, performancePct, benchmarkPct }
}
