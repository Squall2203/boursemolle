export type FreshnessLevel = "green" | "yellow" | "orange" | "red"

export interface FreshnessInfo {
  level: FreshnessLevel
  days: number
  label: string
  dot: string
}

export function getFreshness(dateStr: string | null | undefined): FreshnessInfo | null {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 0) return null
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))

  if (days < 3) return { level: "green", days, dot: "🟢", label: `Mis à jour il y a ${days === 0 ? "aujourd'hui" : days === 1 ? "1 jour" : `${days} jours`}` }
  if (days < 7) return { level: "yellow", days, dot: "🟡", label: `Mis à jour il y a ${days} jours` }
  if (days < 14) return { level: "orange", days, dot: "🟠", label: `Mis à jour il y a ${days} jours` }
  return { level: "red", days, dot: "🔴", label: `Mis à jour il y a ${days} jours — données potentiellement obsolètes` }
}

export function freshnessColor(level: FreshnessLevel): string {
  switch (level) {
    case "green": return "text-emerald-600 dark:text-emerald-400"
    case "yellow": return "text-yellow-600 dark:text-yellow-400"
    case "orange": return "text-orange-600 dark:text-orange-400"
    case "red": return "text-red-600 dark:text-red-400"
  }
}
