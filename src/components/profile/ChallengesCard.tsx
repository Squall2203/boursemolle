import { Trophy, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useChallenges } from "@/hooks/useChallenges"

const METRIC_ICON: Record<string, string> = {
  weekly_trades: "📈",
  weekly_views: "🔍",
  weekly_logins: "📅",
}

export function ChallengesCard() {
  const { items, loading } = useChallenges()

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-5 py-4">
        <h3 className="mb-4 text-sm font-semibold">Défis de la semaine</h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-5 py-4">
        <h3 className="mb-2 text-sm font-semibold">Défis de la semaine</h3>
        <p className="text-sm text-muted-foreground">Aucun défi actif pour l'instant.</p>
      </div>
    )
  }

  const completedCount = items.filter((i) => i.completed).length

  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Défis de la semaine</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{items.length} complétés
        </span>
      </div>

      <div className="space-y-4">
        {items.map(({ challenge, current, target, completed, daysLeft }) => {
          const pct = Math.min(100, Math.round((current / target) * 100))
          const icon = METRIC_ICON[challenge.conditions.metric] ?? "🎯"

          return (
            <div key={challenge.id} className={cn("space-y-2", completed && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none">{icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium leading-tight">
                        {challenge.title}
                      </span>
                      {completed && (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {challenge.description}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-semibold text-amber-500">
                    +{challenge.conditions.xp} XP
                  </div>
                  {!completed && (
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="size-2.5" />
                      {daysLeft}j
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      completed ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{completed ? "Complété !" : `${current} / ${target}`}</span>
                  <span>{pct}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
