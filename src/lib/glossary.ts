/**
 * Lexique : les termes de Bourse utilisés sur le site, expliqués en une phrase.
 * `match` liste les formes du terme reconnues dans les textes pour le rendre cliquable.
 */
export interface GlossaryEntry {
  id: string
  term: string
  /** Définition en une phrase, pour quelqu'un qui débute */
  short: string
  /** Comment le lire et à quoi faire attention */
  more: string
  match: string[]
  category: "Les bases" | "Le prix d'une action" | "La rentabilité" | "La solidité" | "Le dividende" | "Le cours"
}

export const GLOSSARY: GlossaryEntry[] = [
  // ─── Les bases ───
  {
    id: "action", term: "Action", category: "Les bases", match: [],
    short: "Une part de propriété d'une entreprise, qui s'achète et se revend en Bourse.",
    more: "Posséder une action, c'est posséder un petit morceau de l'entreprise : on profite de sa réussite par la hausse du cours et par les dividendes, et on subit ses difficultés de la même façon.",
  },
  {
    id: "pea", term: "PEA", category: "Les bases", match: ["PEA"],
    short: "Plan d'épargne en actions : une enveloppe fiscale française pour investir dans des sociétés européennes.",
    more: "Après cinq ans, les gains ne supportent plus l'impôt sur le revenu, seulement les prélèvements sociaux. En échange, seules les actions de sociétés de l'Espace économique européen y sont admises, et les versements sont plafonnés. L'éligibilité indiquée sur le site est une estimation : à vérifier auprès de son courtier.",
  },
  {
    id: "cto", term: "Compte-titres (CTO)", category: "Les bases", match: ["CTO", "compte-titres"],
    short: "Le compte ordinaire pour acheter des actions du monde entier, sans avantage fiscal.",
    more: "Il n'a ni plafond ni restriction géographique : c'est par lui que passent les actions américaines ou asiatiques. Les gains y sont imposés chaque année.",
  },
  {
    id: "capitalisation", term: "Capitalisation boursière", category: "Les bases", match: ["capitalisation", "valeur en Bourse"],
    short: "La valeur totale de l'entreprise en Bourse : le cours multiplié par le nombre d'actions.",
    more: "Elle donne la taille de la société. Les grandes (plus de 10 milliards d'euros) sont en général plus stables et plus faciles à acheter et revendre ; les petites bougent davantage, dans les deux sens.",
  },
  {
    id: "secteur", term: "Secteur", category: "Les bases", match: ["secteur"],
    short: "La famille d'activité de l'entreprise : santé, banque, technologie, énergie…",
    more: "Les chiffres ne se comparent bien qu'entre sociétés du même secteur : une marge de 5 % est excellente dans la distribution et médiocre dans le logiciel. C'est pourquoi les notes du site situent chaque action parmi ses semblables.",
  },
  {
    id: "mediane", term: "Médiane", category: "Les bases", match: ["médiane"],
    short: "La valeur du milieu : la moitié des sociétés fait mieux, l'autre moitié fait moins bien.",
    more: "On la préfère à la moyenne, qu'une seule société hors norme suffit à fausser.",
  },
  {
    id: "indice", term: "Indice", category: "Les bases", match: ["indice", "CAC 40"],
    short: "Un panier d'actions qui sert de thermomètre du marché, comme le CAC 40 pour les grandes sociétés françaises.",
    more: "Il sert de point de comparaison : une sélection d'actions n'a d'intérêt que si elle fait mieux, sur la durée, que l'indice qu'on aurait pu acheter sans effort.",
  },
  {
    id: "diversification", term: "Diversification", category: "Les bases", match: ["diversification", "diversifié"],
    short: "Répartir son argent entre plusieurs sociétés et plusieurs secteurs pour ne pas dépendre d'un seul.",
    more: "Si une action représente la moitié d'un portefeuille, sa chute emporte tout. Un repère courant : au moins une dizaine de lignes, aucune au-delà de 10 à 15 %, et plusieurs secteurs.",
  },

  // ─── Le prix ───
  {
    id: "per", term: "PER", category: "Le prix d'une action", match: ["PER", "P/E"],
    short: "Le prix de l'action rapporté à son bénéfice annuel : combien d'années de bénéfices on paie.",
    more: "Un PER de 15 signifie qu'on paie 15 fois le bénéfice d'une année. Plus il est bas, moins l'action est chère, à condition que les bénéfices tiennent. Il se compare entre sociétés du même secteur, et n'existe pas quand l'entreprise perd de l'argent.",
  },
  {
    id: "per-previsionnel", term: "PER prévisionnel", category: "Le prix d'une action", match: ["PER prévisionnel", "bénéfices attendus"],
    short: "Le même calcul que le PER, mais avec les bénéfices que les analystes attendent pour l'an prochain.",
    more: "S'il est plus bas que le PER, c'est que le marché attend une hausse des bénéfices. Ce sont des prévisions, régulièrement démenties.",
  },
  {
    id: "ve-ebitda", term: "VE/EBITDA", category: "Le prix d'une action", match: ["VE/EBITDA", "EV/EBITDA"],
    short: "Le prix de l'entreprise entière, dette comprise, rapporté à ce que son activité dégage chaque année.",
    more: "Contrairement au PER, il tient compte de la dette : il évite de trouver bon marché une société très endettée. Il ne s'applique pas aux banques et aux assureurs.",
  },
  {
    id: "cours-actif-net", term: "Cours sur actif net", category: "Le prix d'une action", match: ["valeur comptable", "actif net", "P/B"],
    short: "Le prix de l'action comparé à ce qui resterait aux actionnaires si l'entreprise vendait tout et remboursait ses dettes.",
    more: "En dessous de 1, l'action vaut moins que ses biens au bilan : soit une bonne affaire, soit le signe que ces biens rapportent peu. Surtout parlant pour les banques, l'immobilier et l'industrie.",
  },
  {
    id: "valorisation", term: "Valorisation", category: "Le prix d'une action", match: ["valorisation"],
    short: "Le fait qu'une action soit chère ou bon marché au regard de ce que l'entreprise gagne et possède.",
    more: "Une excellente société peut être un mauvais achat si on la paie trop cher, et inversement. La valorisation se juge avec plusieurs indicateurs, jamais un seul.",
  },

  // ─── La rentabilité ───
  {
    id: "chiffre-affaires", term: "Chiffre d'affaires", category: "La rentabilité", match: ["chiffre d'affaires", "ventes"],
    short: "Le total des ventes de l'entreprise sur une période, avant toute dépense.",
    more: "Sa progression montre si l'entreprise gagne du terrain. Mais vendre plus n'est utile que si cela finit en bénéfices : il se lit toujours avec les marges.",
  },
  {
    id: "benefice", term: "Bénéfice net", category: "La rentabilité", match: ["bénéfice net", "résultat net"],
    short: "Ce qui reste à l'entreprise une fois toutes ses dépenses, ses intérêts et ses impôts payés.",
    more: "C'est lui qui finance les dividendes et les investissements. Rapporté au nombre d'actions, il donne le bénéfice par action.",
  },
  {
    id: "bpa", term: "Bénéfice par action", category: "La rentabilité", match: ["bénéfice par action", "BPA"],
    short: "Le bénéfice net divisé par le nombre d'actions : la part de bénéfice qui revient à chaque action.",
    more: "Sur la durée, le cours d'une action suit la progression de son bénéfice par action, bien plus que celle de ses ventes.",
  },
  {
    id: "marge-operationnelle", term: "Marge opérationnelle", category: "La rentabilité", match: ["marge opérationnelle"],
    short: "Ce qu'il reste sur 100 € de ventes une fois payés les coûts de l'activité.",
    more: "Une marge élevée et stable signale souvent un avantage sur les concurrents : une marque, une technologie, une position dominante. Elle varie beaucoup d'un secteur à l'autre.",
  },
  {
    id: "marge-nette", term: "Marge nette", category: "La rentabilité", match: ["marge nette"],
    short: "Ce qu'il reste sur 100 € de ventes après toutes les dépenses, intérêts et impôts compris.",
    more: "Elle est toujours inférieure à la marge opérationnelle. Un grand écart entre les deux trahit souvent une dette coûteuse.",
  },
  {
    id: "roe", term: "ROE", category: "La rentabilité", match: ["ROE", "rentabilité des capitaux propres"],
    short: "Ce que l'entreprise gagne chaque année pour 100 € confiés par ses actionnaires.",
    more: "Au-delà de 15 %, c'est une société très rentable. Attention : s'endetter fait monter le ROE sans rendre l'entreprise meilleure, d'où l'intérêt de regarder aussi le ROA.",
  },
  {
    id: "roa", term: "ROA", category: "La rentabilité", match: ["ROA"],
    short: "Ce que l'entreprise gagne chaque année rapporté à tout ce qu'elle possède.",
    more: "Il n'est pas gonflé par la dette, contrairement au ROE. Il est naturellement bas dans les secteurs qui demandent beaucoup d'équipements ou de capitaux, comme l'énergie ou la banque.",
  },
  {
    id: "flux-tresorerie", term: "Flux de trésorerie", category: "La rentabilité", match: ["flux de trésorerie", "trésorerie dégagée"],
    short: "L'argent réellement entré dans les caisses, une fois les investissements payés.",
    more: "Un bénéfice est une écriture comptable ; la trésorerie, elle, ne se discute pas. Une société qui affiche des bénéfices sans dégager de trésorerie mérite un examen attentif.",
  },

  // ─── La solidité ───
  {
    id: "capitaux-propres", term: "Capitaux propres", category: "La solidité", match: ["capitaux propres"],
    short: "L'argent qui appartient aux actionnaires : ce qu'ils ont apporté, plus les bénéfices laissés dans l'entreprise.",
    more: "C'est le coussin qui absorbe les pertes avant que les créanciers ne soient touchés. Plus il est épais par rapport à la dette, plus l'entreprise est solide.",
  },
  {
    id: "dette-nette", term: "Dette nette", category: "La solidité", match: ["dette nette", "trésorerie nette"],
    short: "Ce que l'entreprise doit, moins l'argent qu'elle a en caisse.",
    more: "Si la caisse dépasse la dette, on parle de trésorerie nette : l'entreprise pourrait tout rembourser demain. Une dette lourde n'est pas un problème tant que les bénéfices suivent, mais elle rend vulnérable à une mauvaise année ou à une hausse des taux.",
  },

  // ─── Le dividende ───
  {
    id: "dividende", term: "Dividende", category: "Le dividende", match: ["dividende"],
    short: "La part des bénéfices que l'entreprise verse en argent à ses actionnaires, en général une fois par an.",
    more: "Il n'est jamais garanti : l'entreprise peut le réduire ou le supprimer. Une société qui n'en verse pas n'est pas moins bonne, elle préfère réinvestir ses bénéfices.",
  },
  {
    id: "rendement", term: "Rendement du dividende", category: "Le dividende", match: ["rendement"],
    short: "Le dividende annuel rapporté au cours de l'action : ce que rapporte le dividende pour 100 € investis.",
    more: "Un rendement de 4 % verse 4 € par an pour 100 € placés. Au-delà de 7 à 8 %, méfiance : c'est souvent que le cours a chuté parce que le marché s'attend à une baisse du dividende.",
  },
  {
    id: "taux-distribution", term: "Taux de distribution", category: "Le dividende", match: ["taux de distribution", "payout"],
    short: "La part des bénéfices reversée en dividendes.",
    more: "Entre 30 et 60 %, le dividende laisse de quoi investir et encaisser une mauvaise année. Au-delà de 80 %, il devient fragile ; au-delà de 100 %, l'entreprise distribue plus qu'elle ne gagne.",
  },

  // ─── Le cours ───
  {
    id: "moyenne-mobile", term: "Moyenne mobile", category: "Le cours", match: ["moyenne mobile", "moyenne des 200", "moyenne des 50", "moyenne 200 jours", "moyenne 50 jours"],
    short: "La moyenne du cours sur les dernières séances, recalculée chaque jour, qui lisse les à-coups.",
    more: "Sur 200 séances (environ dix mois), elle donne la tendance de fond : un cours au-dessus signale une tendance haussière. Sur 50 séances, elle donne la tendance récente.",
  },
  {
    id: "croisement", term: "Croisement de moyennes", category: "Le cours", match: ["croisement haussier", "croisement baissier", "golden cross", "death cross"],
    short: "Le moment où la tendance récente du cours passe au-dessus ou au-dessous de sa tendance de fond.",
    more: "Quand la moyenne sur 50 séances passe au-dessus de celle sur 200, les analystes techniques y voient le début possible d'une hausse (et l'inverse). C'est un indice, souvent en retard, jamais une certitude.",
  },
  {
    id: "rsi", term: "RSI", category: "Le cours", match: ["RSI"],
    short: "Un indicateur de 0 à 100 qui dit si l'action a surtout été achetée ou surtout vendue ces derniers jours.",
    more: "Au-dessus de 70, elle a beaucoup monté très vite et une pause est fréquente. En dessous de 30, elle a été massivement vendue : cela peut précéder un rebond, ou traduire un vrai problème.",
  },
  {
    id: "momentum", term: "Momentum", category: "Le cours", match: ["momentum", "tendance du cours"],
    short: "L'élan du cours : la tendance d'une action qui monte à continuer de monter quelque temps, et inversement.",
    more: "Il ne dit rien de la qualité de l'entreprise. Il aide surtout à ne pas acheter une action en pleine chute.",
  },
  {
    id: "volatilite", term: "Volatilité", category: "Le cours", match: ["volatilité"],
    short: "L'ampleur des variations du cours : une action volatile monte et descend fort.",
    more: "Elle mesure l'inconfort plus que le danger : une action très volatile peut être une bonne société, mais elle demande d'avoir le cœur bien accroché et de ne pas avoir besoin de l'argent à court terme.",
  },
]

export const GLOSSARY_BY_ID = new Map(GLOSSARY.map((e) => [e.id, e]))

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Les formes les plus longues d'abord : « marge opérationnelle » doit l'emporter sur un terme plus court
const FORMS = GLOSSARY.flatMap((e) => e.match.map((form) => ({ form, id: e.id }))).sort((a, b) => b.form.length - a.form.length)
const FORM_TO_ID = new Map(FORMS.map((f) => [f.form.toLowerCase(), f.id]))
// Limites de mot adaptées au français : une lettre accentuée fait partie du mot
const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${FORMS.map((f) => escapeRegExp(f.form)).join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
)

export type GlossarySegment = { text: string; entryId?: string }

/**
 * Découpe un texte en morceaux, en repérant les termes du lexique.
 * Chaque terme n'est signalé qu'à sa première apparition, pour ne pas surcharger la lecture.
 */
export function splitGlossaryTerms(text: string, alreadySeen?: Set<string>): GlossarySegment[] {
  const seen = alreadySeen ?? new Set<string>()
  const segments: GlossarySegment[] = []
  let last = 0
  for (const m of text.matchAll(PATTERN)) {
    const id = FORM_TO_ID.get(m[1].toLowerCase())
    if (!id || seen.has(id)) continue
    seen.add(id)
    if (m.index > last) segments.push({ text: text.slice(last, m.index) })
    segments.push({ text: m[1], entryId: id })
    last = m.index + m[1].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}
