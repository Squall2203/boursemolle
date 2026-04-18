import { getLevelInfo } from "@/lib/xp"
import { cn } from "@/lib/utils"

interface LevelProgressProps {
  xp: number
  level: number
}

export function LevelProgress({ xp, level }: LevelProgressProps) {
  const { current, next, progressPercent, xpToNext } = getLevelInfo(xp)

  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">Niveau {level}</span>
            <span className="text-lg text-muted-foreground">— {current.title}</span>
          </div>
          {next && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Prochain : <span className="font-medium text-foreground">{next.title}</span>
              {xpToNext != null && (
                <span className="ml-1 text-muted-foreground">({xpToNext.toLocaleString("fr-FR")} XP restants)</span>
              )}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums">{xp.toLocaleString("fr-FR")}</span>
          <div className="text-xs text-muted-foreground">XP total</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{current.xpRequired.toLocaleString("fr-FR")} XP</span>
          {next && <span>{next.xpRequired.toLocaleString("fr-FR")} XP</span>}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              level >= 8 ? "bg-yellow-500" : level >= 5 ? "bg-primary" : "bg-primary/70",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {level === 10 && (
          <p className="mt-2 text-center text-sm font-medium text-yellow-600 dark:text-yellow-400">
            Niveau maximum atteint — Warren Mouffet 🎉
          </p>
        )}
      </div>
    </div>
  )
}
