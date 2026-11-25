import type { Stock } from "../types/stock"
import type { StockScore } from "./scoring"

/**
 * Titre et description d'une fiche action, pour l'onglet du navigateur, les moteurs de recherche
 * et l'aperçu affiché quand on partage le lien. Utilisé par la page et par la compilation.
 */
export function stockMeta(stock: Stock, score: StockScore): { title: string; description: string } {
  const note = score.total.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const pea = stock.peaEligible ? "Éligible au PEA. " : ""
  return {
    title: `${stock.name} (${stock.ticker}) : note ${note}/10 expliquée`,
    description: `${pea}${score.label} (${note} sur 10). ${score.summary} Ce qui tire la note vers le haut, ce qui est à surveiller, critère par critère.`,
  }
}
