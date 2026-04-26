import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Calendar, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { usePicks } from "@/hooks/usePicks"
import { usePicksHistory } from "@/hooks/usePicksHistory"
import type { StrategyResult } from "@/types/picks"

const MARKET_FLAG: Record<string, string> = {
  FR: "🇫🇷",
  EU: "🇪🇺",
  US: "🇺🇸",
  WORLD: "🌍",
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function MiniScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? "bg-emerald-500" :
    score >= 6.5 ? "bg-green-500" :
    score >= 5 ? "bg-yellow-500" : "bg-red-400"

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium">{score.toFixed(1)}</span>
    </div>
  )
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({ strategy, lastPerf }: { strategy: StrategyResult; lastPerf?: number | null }) {
  const avgScore = useMemo(() => {
    if (!strategy.picks.length) return null
    return strategy.picks.reduce((s, p) => s + p.score, 0) / strategy.picks.length
  }, [strategy.picks])

  const topPicks = strategy.picks.slice(0, 6)
  const newCount = strategy.picks.filter((p) => p.isNew).length

  return (
    <Link to={`/picks/${strategy.id}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-hidden="true">
                {strategy.emoji}
              </span>
              <div>
                <p className="text-xs text-muted-foreground">
                  {MARKET_FLAG[strategy.market]} {strategy.marketLabel}
                </p>
                <h3 className="font-semibold leading-tight tracking-tight">{strategy.name}</h3>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Algorithme
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-5">
          <p className="text-sm text-muted-foreground leading-snug">{strategy.description}</p>

          {/* Avg score */}
          {avgScore != null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Score moyen</span>
              <MiniScoreBar score={avgScore} />
            </div>
          )}

          {/* Ticker chips */}
          <div className="flex flex-wrap gap-1.5">
            {topPicks.map((p) => (
              <span
                key={p.ticker}
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono font-medium",
                  p.isNew
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {p.ticker}
              </span>
            ))}
            {strategy.picks.length > 6 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] text-muted-foreground bg-muted">
                +{strategy.picks.length - 6}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{strategy.picks.length} sélections</span>
              {newCount > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  +{newCount} nouveau{newCount > 1 ? "x" : ""}
                </span>
              )}
              {lastPerf != null && (
                <span className={cn(
                  "flex items-center gap-0.5 font-medium",
                  lastPerf >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                )}>
                  {lastPerf >= 0
                    ? <TrendingUp className="size-3" />
                    : <TrendingDown className="size-3" />}
                  {lastPerf >= 0 ? "+" : ""}{lastPerf.toFixed(1)}% mois préc.
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
              Voir les sélections
              <ArrowRight className="size-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PicksPage() {
  const { data, loading, error } = usePicks()
  const { data: history } = usePicksHistory()

  const lastPerfByStrategy = useMemo(() => {
    const latest = history?.entries[0]
    if (!latest) return {}
    const out: Record<string, number | null> = {}
    for (const [id, entry] of Object.entries(latest.strategies)) {
      out[id] = entry.portfolioReturn
    }
    return out
  }, [history])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-20 rounded-xl bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">
          Sélections non disponibles.{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </p>
      </div>
    )
  }

  const days = daysUntil(data.nextUpdate)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">AlphaPicks</h1>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] uppercase tracking-wider font-semibold">
              Bêta
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sélections algorithmiques mensuelles · {formatPeriod(data.period)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="size-3.5" />
            Mis à jour le {new Date(data.generatedAt).toLocaleDateString("fr-FR")}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            Prochain rééquilibrage dans {days} jour{days > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Intro */}
      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Comment ça fonctionne.</span>{" "}
          Chaque mois, un algorithme de scoring multifactoriel analyse l'ensemble de l'univers BourseMolle
          et sélectionne les actions les plus prometteuses selon 6 critères — valorisation, qualité,
          croissance, solidité financière, dividende et momentum. Chaque stratégie pondère ces critères
          différemment selon son objectif.
        </p>
      </div>

      {/* Strategy grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.strategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            lastPerf={lastPerfByStrategy[strategy.id]}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
        AlphaPicks est un outil de recherche algorithmique à titre informatif uniquement.
        Les performances passées ne préjugent pas des performances futures.
        Ne constitue pas un conseil en investissement au sens de la Directive MiFID II.
      </p>
    </div>
  )
}
