export interface BadgeDefinition {
  id: string
  name: string
  icon: string
  description: string
  category: "performance" | "engagement"
  progress?: (data: BadgeProgressData) => { current: number; target: number } | null
}

export interface BadgeProgressData {
  viewedStockCount: number
  tradeCount: number
}

export const BADGES: BadgeDefinition[] = [
  // Performance
  {
    id: "first_trade",
    name: "Premier trade",
    icon: "🎬",
    description: "Passer votre premier ordre",
    category: "performance",
    progress: (d) => ({ current: Math.min(d.tradeCount, 1), target: 1 }),
  },
  {
    id: "diamond_hands",
    name: "Mains de diamant",
    icon: "💎",
    description: "Tenir une position > 90 jours avec P/L > +15%",
    category: "performance",
  },
  {
    id: "paper_hands",
    name: "Mains de papier",
    icon: "🧻",
    description: "Vendre une position avec une perte > -20% (on apprend !)",
    category: "performance",
  },
  {
    id: "index_beater",
    name: "Batteur d'indice",
    icon: "📈",
    description: "Battre le S&P 500 sur 3 mois",
    category: "performance",
  },
  {
    id: "month_manager",
    name: "Gérant du mois",
    icon: "🏆",
    description: "Top 1 du classement mensuel",
    category: "performance",
  },
  {
    id: "marathoner",
    name: "Marathonien",
    icon: "🎖️",
    description: "12 mois de Paper PEA actif",
    category: "performance",
  },
  {
    id: "perfect_streak",
    name: "Sans faute",
    icon: "✅",
    description: "5 trades consécutifs en plus-value",
    category: "performance",
  },
  {
    id: "lesson_learned",
    name: "Leçon apprise",
    icon: "📚",
    description: "3 trades consécutifs en perte (on apprend de ses erreurs)",
    category: "performance",
  },
  // Engagement
  {
    id: "regular",
    name: "Habitué",
    icon: "🔥",
    description: "7 jours de connexion consécutifs",
    category: "engagement",
  },
  {
    id: "faithful",
    name: "Fidèle",
    icon: "🔥🔥",
    description: "30 jours de connexion consécutifs",
    category: "engagement",
  },
  {
    id: "addicted",
    name: "Accro",
    icon: "🔥🔥🔥",
    description: "100 jours de connexion consécutifs",
    category: "engagement",
  },
  {
    id: "explorer",
    name: "Explorateur",
    icon: "🗺️",
    description: "Consulter 50 fiches actions différentes",
    category: "engagement",
    progress: (d) => ({ current: Math.min(d.viewedStockCount, 50), target: 50 }),
  },
  {
    id: "encyclopedist",
    name: "Encyclopédiste",
    icon: "📖",
    description: "Consulter 200 fiches actions différentes",
    category: "engagement",
    progress: (d) => ({ current: Math.min(d.viewedStockCount, 200), target: 200 }),
  },
  {
    id: "methodical",
    name: "Méthodique",
    icon: "⚙️",
    description: "Sauvegarder 5 screeners personnalisés",
    category: "engagement",
  },
  {
    id: "early_adopter",
    name: "Early adopter",
    icon: "🚀",
    description: "Compte créé dans les 3 premiers mois du lancement",
    category: "engagement",
  },
]

export function getBadge(id: string): BadgeDefinition | undefined {
  return BADGES.find((b) => b.id === id)
}
