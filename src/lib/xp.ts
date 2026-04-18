export const LEVELS = [
  { level: 1, title: "Curieux", xpRequired: 0 },
  { level: 2, title: "Débutant", xpRequired: 100 },
  { level: 3, title: "Initié", xpRequired: 300 },
  { level: 4, title: "Investisseur", xpRequired: 700 },
  { level: 5, title: "Analyste", xpRequired: 1500 },
  { level: 6, title: "Stratège", xpRequired: 3000 },
  { level: 7, title: "Expert", xpRequired: 6000 },
  { level: 8, title: "Maître", xpRequired: 10000 },
  { level: 9, title: "Légende", xpRequired: 20000 },
  { level: 10, title: "Warren Mouffet", xpRequired: 50000 },
] as const

export type LevelEntry = (typeof LEVELS)[number]

export interface LevelInfo {
  current: LevelEntry
  next: LevelEntry | null
  progressPercent: number
  xpToNext: number | null
}

export function getLevelInfo(xp: number): LevelInfo {
  let currentIdx = 0
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      currentIdx = i
      break
    }
  }
  const current = LEVELS[currentIdx]
  const next = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null
  const progressPercent = next
    ? Math.min(100, ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100)
    : 100
  const xpToNext = next ? next.xpRequired - xp : null
  return { current, next, progressPercent, xpToNext }
}

export const XP_ACTIONS = {
  CREATE_ACCOUNT: { action: "create_account", xp: 50, dailyMax: undefined },
  CREATE_PORTFOLIO: { action: "create_portfolio", xp: 50, dailyMax: undefined },
  TRADE: { action: "trade", xp: 10, dailyMax: 5 },
  VIEW_STOCK_EXPERT: { action: "view_stock_expert", xp: 5, dailyMax: 10 },
  USE_COMPARE: { action: "use_compare", xp: 10, dailyMax: 3 },
  SCREENER_FILTERS: { action: "screener_filters", xp: 10, dailyMax: 1 },
  READ_METHODOLOGY: { action: "read_methodology", xp: 30, dailyMax: undefined },
  DAILY_LOGIN: { action: "daily_login", xp: 5, dailyMax: 1 },
} as const
