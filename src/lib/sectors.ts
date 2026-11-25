/** Noms des secteurs en français (les données les fournissent en anglais). */
export const SECTOR_LABELS: Record<string, string> = {
  "Technology": "Technologie",
  "Healthcare": "Santé",
  "Financial Services": "Finance",
  "Consumer Cyclical": "Consommation cyclique",
  "Consumer Defensive": "Consommation de base",
  "Industrials": "Industrie",
  "Communication Services": "Télécoms et médias",
  "Basic Materials": "Matériaux de base",
  "Real Estate": "Immobilier",
  "Energy": "Énergie",
  "Utilities": "Services aux collectivités",
}

export function sectorLabel(sector: string | null | undefined): string {
  if (!sector) return "Secteur inconnu"
  return SECTOR_LABELS[sector] ?? sector
}
