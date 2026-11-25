import { PRESETS, type Preset } from "@/lib/presets"
import { DEFAULT_FILTERS, type ScreenerFilters } from "@/types/filters"
import { filtersToParams } from "@/hooks/useScreenerFilters"

/** Un point de départ pour un débutant : un objectif en mots simples, relié à une présélection du screener. */
export interface Objective {
  id: string
  title: string
  /** Ce que la personne cherche, à la première personne */
  need: string
  presetId: string
  /** Ce que fait la sélection, sans jargon */
  what: string
  /** Ce qu'il faut garder en tête avant de se décider */
  caution: string
}

export const OBJECTIVES: Objective[] = [
  {
    id: "revenus",
    title: "Toucher des revenus réguliers",
    need: "Je veux des actions qui me versent un dividende chaque année.",
    presetId: "dividend",
    what: "Des sociétés qui versent un dividende d'au moins 3 %, rentables, et dont le dividende est bien noté : régulier et pas trop lourd par rapport aux bénéfices.",
    caution: "Un dividende n'est jamais garanti. Regardez sur chaque fiche la part des bénéfices distribuée : au-delà de 80 %, il est fragile.",
  },
  {
    id: "croissance",
    title: "Faire grandir mon capital",
    need: "Je vise la hausse du cours sur plusieurs années, quitte à ne pas toucher de dividende.",
    presetId: "growth",
    what: "De grandes sociétés très rentables dont les ventes et les bénéfices progressent nettement.",
    caution: "Ces actions sont souvent chères : le marché a déjà remarqué leur qualité. Vérifiez le critère Valorisation sur la fiche, et prévoyez de les garder longtemps.",
  },
  {
    id: "prudence",
    title: "Investir prudemment",
    need: "Je veux d'abord des entreprises solides, qui tiendront en cas de crise.",
    presetId: "forteresses",
    what: "Des sociétés peu endettées, bénéficiaires année après année, et plus rentables que leurs concurrentes.",
    caution: "Solide ne veut pas dire sans risque : le cours d'une bonne entreprise peut baisser de 20 à 30 % dans un marché difficile. La prudence passe aussi par la diversification.",
  },
  {
    id: "decouverte",
    title: "Voir les mieux notées",
    need: "Je découvre : montrez-moi les actions les mieux notées, tous critères confondus.",
    presetId: "topscores",
    what: "Les actions dont la note générale atteint au moins 7,5 sur 10, c'est-à-dire bonnes sur la plupart des sept critères à la fois.",
    caution: "Une bonne note décrit les chiffres d'aujourd'hui, pas l'avenir. Ouvrez chaque fiche pour lire ce qui tire la note vers le haut et ce qui est à surveiller.",
  },
]

export function getObjective(id: string | null): Objective | undefined {
  return OBJECTIVES.find((o) => o.id === id)
}

export function objectivePreset(objective: Objective): Preset | undefined {
  return PRESETS.find((p) => p.id === objective.presetId)
}

/** Adresse du screener réglé pour cet objectif, sur les actions éligibles au PEA. */
export function objectiveUrl(objective: Objective): string {
  const preset = objectivePreset(objective)
  const filters: ScreenerFilters = { ...DEFAULT_FILTERS, ...(preset?.filters ?? {}), market: "pea" }
  const params = filtersToParams(filters)
  params.set("objectif", objective.id)
  return `/screener?${params.toString()}`
}
