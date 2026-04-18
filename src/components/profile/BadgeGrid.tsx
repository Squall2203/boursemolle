import { BADGES } from "@/lib/badges"
import { cn } from "@/lib/utils"
import type { BadgeProgressData } from "@/lib/badges"

interface BadgeGridProps {
  earnedIds: Set<string>
  progressData: BadgeProgressData
}

export function BadgeGrid({ earnedIds, progressData }: BadgeGridProps) {
  const earned = BADGES.filter((b) => earnedIds.has(b.id))
  const locked = BADGES.filter((b) => !earnedIds.has(b.id))

  const categories = [
    { key: "performance" as const, label: "Performance" },
    { key: "engagement" as const, label: "Engagement" },
  ]

  return (
    <div className="space-y-6">
      {earned.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Badges obtenus ({earned.length}/{BADGES.length})
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map((b) => (
              <BadgeCard key={b.id} badge={b} earned progressData={progressData} />
            ))}
          </div>
        </div>
      )}

      {categories.map(({ key, label }) => {
        const lockedInCat = locked.filter((b) => b.category === key)
        if (lockedInCat.length === 0) return null
        return (
          <div key={key}>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {label} — à débloquer
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {lockedInCat.map((b) => (
                <BadgeCard key={b.id} badge={b} earned={false} progressData={progressData} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BadgeCard({
  badge,
  earned,
  progressData,
}: {
  badge: (typeof BADGES)[number]
  earned: boolean
  progressData: BadgeProgressData
}) {
  const progress = badge.progress?.(progressData)

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        earned ? "bg-card" : "bg-muted/30 opacity-60",
      )}
    >
      <div className="text-2xl">{badge.icon}</div>
      <div className="mt-1.5 text-sm font-medium leading-tight">{badge.name}</div>
      <div className="mt-0.5 text-xs text-muted-foreground leading-tight">{badge.description}</div>
      {!earned && progress && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/50 transition-all"
              style={{ width: `${(progress.current / progress.target) * 100}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {progress.current}/{progress.target}
          </p>
        </div>
      )}
    </div>
  )
}
