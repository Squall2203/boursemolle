import { FILTER_BOUNDS, type ScreenerFilters } from "@/types/filters"

export interface PresetCriterion {
  label: string
  value: string
}

export interface Preset {
  id: string
  name: string
  description: string
  criteria: PresetCriterion[]
  filters: ScreenerFilters
}

const full = (key: keyof typeof FILTER_BOUNDS) => ({
  min: FILTER_BOUNDS[key].min,
  max: FILTER_BOUNDS[key].max,
})

export const PRESETS: Preset[] = [
  {
    id: "value",
    name: "Value PEA",
    description: "Actions sous-évaluées par rapport à leurs bénéfices, avec une rentabilité correcte",
    criteria: [
      { label: "P/E", value: "< 15" },
      { label: "ROE", value: "> 8%" },
      { label: "Dividende", value: "> 1.5%" },
    ],
    filters: {
      pe: { min: 0, max: 15 },
      roe: { min: 8, max: FILTER_BOUNDS.roe.max },
      divYield: { min: 1.5, max: FILTER_BOUNDS.divYield.max },
      marketCap: full("marketCap"),
      sectors: [],
      countries: [],
    },
  },
  {
    id: "dividend",
    name: "Dividendes qualité",
    description: "Rendement élevé et soutenable, entreprises profitables avec bilan solide",
    criteria: [
      { label: "Dividende", value: "> 3%" },
      { label: "ROE", value: "> 10%" },
      { label: "P/E", value: "< 25" },
    ],
    filters: {
      divYield: { min: 3, max: FILTER_BOUNDS.divYield.max },
      roe: { min: 10, max: FILTER_BOUNDS.roe.max },
      pe: { min: 0, max: 25 },
      marketCap: full("marketCap"),
      sectors: [],
      countries: [],
    },
  },
  {
    id: "growth",
    name: "Croissance rentable",
    description: "Entreprises à forte rentabilité, souvent en croissance, acceptant une prime de valorisation",
    criteria: [
      { label: "ROE", value: "> 15%" },
      { label: "Marge", value: "implicite élevée" },
      { label: "Capi", value: "> 10 Md€" },
    ],
    filters: {
      roe: { min: 15, max: FILTER_BOUNDS.roe.max },
      marketCap: { min: 10, max: FILTER_BOUNDS.marketCap.max },
      pe: full("pe"),
      divYield: full("divYield"),
      sectors: [],
      countries: [],
    },
  },
  {
    id: "largecap",
    name: "Blue chips",
    description: "Grandes capitalisations européennes, leaders sectoriels, forte liquidité",
    criteria: [
      { label: "Capi", value: "> 80 Md€" },
      { label: "ROE", value: "> 5%" },
    ],
    filters: {
      marketCap: { min: 80, max: FILTER_BOUNDS.marketCap.max },
      roe: { min: 5, max: FILTER_BOUNDS.roe.max },
      pe: full("pe"),
      divYield: full("divYield"),
      sectors: [],
      countries: [],
    },
  },
  {
    id: "deepvalue",
    name: "Deep value",
    description: "Actions très décotées, P/E très bas — potentiel de revalorisation mais risque plus élevé",
    criteria: [
      { label: "P/E", value: "< 10" },
      { label: "ROE", value: "> 0%" },
    ],
    filters: {
      pe: { min: 0, max: 10 },
      roe: { min: 0, max: FILTER_BOUNDS.roe.max },
      marketCap: full("marketCap"),
      divYield: full("divYield"),
      sectors: [],
      countries: [],
    },
  },
]
