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
  filters: Partial<ScreenerFilters>
}

const full = (key: keyof typeof FILTER_BOUNDS) => ({
  min: FILTER_BOUNDS[key].min,
  max: FILTER_BOUNDS[key].max,
})

const BASE_TECH = {
  rsi: full("rsi"),
  perf1M: full("perf1M"),
  perf6M: full("perf6M"),
  perf1Y: full("perf1Y"),
}

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
      ...BASE_TECH,
      indices: [],
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
      ...BASE_TECH,
      indices: [],
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
      { label: "Capi", value: "> 10 Md€" },
    ],
    filters: {
      roe: { min: 15, max: FILTER_BOUNDS.roe.max },
      marketCap: { min: 10, max: FILTER_BOUNDS.marketCap.max },
      pe: full("pe"),
      divYield: full("divYield"),
      ...BASE_TECH,
      indices: [],
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
      ...BASE_TECH,
      indices: [],
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
      ...BASE_TECH,
      indices: [],
      sectors: [],
      countries: [],
    },
  },
  {
    id: "momentum",
    name: "Momentum",
    description: "Actions en forte hausse récente avec un RSI dynamique — suivre la tendance",
    criteria: [
      { label: "Perf 1M", value: "> 5%" },
      { label: "Perf 6M", value: "> 15%" },
      { label: "RSI", value: "50 – 80" },
    ],
    filters: {
      pe: full("pe"),
      roe: full("roe"),
      marketCap: full("marketCap"),
      divYield: full("divYield"),
      rsi: { min: 50, max: 80 },
      perf1M: { min: 5, max: FILTER_BOUNDS.perf1M.max },
      perf6M: { min: 15, max: FILTER_BOUNDS.perf6M.max },
      perf1Y: full("perf1Y"),
      indices: [],
      sectors: [],
      countries: [],
    },
  },
  {
    id: "oversold",
    name: "Survendues",
    description: "Actions en zone de survente (RSI bas) — potentiel rebond technique",
    criteria: [
      { label: "RSI", value: "< 35" },
      { label: "Capi", value: "> 5 Md€" },
    ],
    filters: {
      pe: full("pe"),
      roe: full("roe"),
      marketCap: { min: 5, max: FILTER_BOUNDS.marketCap.max },
      divYield: full("divYield"),
      rsi: { min: 0, max: 35 },
      perf1M: full("perf1M"),
      perf6M: full("perf6M"),
      perf1Y: full("perf1Y"),
      indices: [],
      sectors: [],
      countries: [],
    },
  },
]
