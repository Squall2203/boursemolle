import { useState, useMemo } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Info, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { usePicks } from "@/hooks/usePicks"
import { usePicksHistory } from "@/hooks/usePicksHistory"
import { formatPrice, formatMarketCap, formatPercent } from "@/lib/format"
import type { StrategyPick, PickPillars, PicksHistoryPeriod } from "@/types/picks"

const MARKET_FLAG: Record<string, string> = {
  FR: "🇫🇷",
  EU: "🇪🇺",
  US: "🇺🇸",
  WORLD: "🌍",
}

const PILLAR_LABELS: Record<keyof PickPillars, string> = {
  valorisation: "Valo.",
  qualite: "Qual.",
  croissance: "Crois.",
  sante: "Santé",
  dividende: "Div.",
  momentum: "Mom.",
}

const PILLAR_COLORS: Record<keyof PickPillars, string> = {
  valorisation: "bg-violet-500",
  qualite: "bg-blue-500",
  croissance: "bg-emerald-500",
  sante: "bg-teal-500",
  dividende: "bg-amber-500",
  momentum: "bg-orange-500",
}

// ─── Score bar inline ─────────────────────────────────────────────────────────

function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? "bg-emerald-500" :
    score >= 6.5 ? "bg-green-500" :
    score >= 5 ? "bg-yellow-500" : "bg-red-400"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-14 flex-shrink-0 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  )
}

// ─── Pillar sparkbars ─────────────────────────────────────────────────────────

function PillarBars({ pillars }: { pillars: PickPillars }) {
  return (
    <div className="flex items-end gap-2">
      {(Object.entries(pillars) as [keyof PickPillars, number][]).map(([key, val]) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <span className="text-[9px] tabular-nums font-medium text-muted-foreground">{val.toFixed(1)}</span>
          <div className="w-7 h-10 bg-muted rounded-sm overflow-hidden flex items-end">
            <div
              className={cn("w-full rounded-sm transition-all", PILLAR_COLORS[key])}
              style={{ height: `${(val / 10) * 100}%`, opacity: 0.85 }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground text-center leading-tight w-7">
            {PILLAR_LABELS[key]}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

function ExpandedRow({ pick, colSpan }: { pick: StrategyPick; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="border-t border-border/50 bg-muted/20 px-5 py-4 flex flex-wrap items-start gap-6">
          <PillarBars pillars={pick.pillars} />
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Pourquoi cette sélection
            </p>
            <p className="text-sm text-foreground leading-relaxed">{pick.justification}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {pick.pe != null && <span>P/E : <span className="font-medium text-foreground">{pick.pe.toFixed(1)}x</span></span>}
              {pick.roe != null && <span>ROE : <span className="font-medium text-foreground">{pick.roe.toFixed(0)}%</span></span>}
              {pick.marketCap != null && <span>Capi : <span className="font-medium text-foreground">{formatMarketCap(pick.marketCap, pick.currency)}</span></span>}
              {pick.peaEligible && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ PEA</span>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Pick row ─────────────────────────────────────────────────────────────────

function PickRow({
  pick,
  expanded,
  onToggle,
}: {
  pick: StrategyPick
  expanded: boolean
  onToggle: () => void
}) {
  const isPos = (pick.perf6M ?? 0) >= 0

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 transition-colors cursor-pointer select-none",
          expanded ? "bg-muted/30" : "hover:bg-muted/20",
        )}
        onClick={onToggle}
      >
        {/* Rank */}
        <td className="pl-5 pr-3 py-3.5 text-xs font-bold text-muted-foreground tabular-nums">
          {pick.rank}
        </td>

        {/* Action */}
        <td className="px-3 py-3.5">
          <div className="flex items-start gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/stock/${pick.ticker}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono font-semibold text-sm hover:text-primary hover:underline"
                >
                  {pick.ticker}
                </Link>
                {pick.isNew && (
                  <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border-0 font-semibold uppercase tracking-wider">
                    Nouveau
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[160px] mt-0.5">{pick.name}</p>
            </div>
          </div>
        </td>

        {/* Score */}
        <td className="px-3 py-3.5">
          <ScoreBar score={pick.score} />
        </td>

        {/* Poids */}
        <td className="px-3 py-3.5 text-right text-sm tabular-nums text-muted-foreground">
          {(pick.weight * 100).toFixed(0)}%
        </td>

        {/* P/E */}
        <td className="px-3 py-3.5 text-right text-sm tabular-nums">
          {pick.pe != null ? pick.pe.toFixed(1) : <span className="text-muted-foreground">—</span>}
        </td>

        {/* ROE */}
        <td className="px-3 py-3.5 text-right text-sm tabular-nums">
          {pick.roe != null ? (
            <span>{pick.roe.toFixed(0)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* Perf 6M */}
        <td className={cn("px-3 py-3.5 text-right text-sm tabular-nums font-medium", isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
          {pick.perf6M != null ? formatPercent(pick.perf6M, true) : <span className="text-muted-foreground">—</span>}
        </td>

        {/* Dividende */}
        <td className="px-3 py-3.5 text-right text-sm tabular-nums text-muted-foreground">
          {pick.divYield != null && pick.divYield > 0 ? (
            <span className="text-foreground">{pick.divYield.toFixed(1)}%</span>
          ) : (
            "—"
          )}
        </td>

        {/* Prix */}
        <td className="px-3 py-3.5 text-right text-sm tabular-nums text-muted-foreground">
          {pick.price != null ? formatPrice(pick.price, pick.currency) : "—"}
        </td>

        {/* Expand */}
        <td className="pl-3 pr-5 py-3.5 text-right">
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </td>
      </tr>
      {expanded && <ExpandedRow pick={pick} colSpan={10} />}
    </>
  )
}

// ─── Performance history ──────────────────────────────────────────────────────

function formatPeriod(period: string): string {
  const [year, month] = period.split("-")
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

function PerfRow({
  entry,
  strategyId,
}: {
  entry: PicksHistoryPeriod
  strategyId: string
}) {
  const [open, setOpen] = useState(false)
  const strat = entry.strategies[strategyId]
  if (!strat) return null

  const perf = strat.portfolioReturn
  const isPos = perf != null && perf >= 0
  const sortedPicks = [...strat.picks].sort((a, b) => (b.return ?? -Infinity) - (a.return ?? -Infinity))

  return (
    <>
      <tr
        className="border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="pl-5 pr-3 py-3 text-sm font-medium capitalize">{formatPeriod(entry.period)}</td>
        <td className={cn("px-3 py-3 text-sm font-semibold tabular-nums", perf == null ? "text-muted-foreground" : isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
          {perf != null ? (
            <span className="flex items-center gap-1">
              {isPos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {isPos ? "+" : ""}{perf.toFixed(2)}%
            </span>
          ) : "—"}
        </td>
        <td className="px-3 py-3 text-sm tabular-nums text-muted-foreground">
          {strat.benchmarkReturn != null ? (
            <span className={strat.benchmarkReturn >= 0 ? "text-foreground" : "text-red-400"}>
              {strat.benchmarkReturn >= 0 ? "+" : ""}{strat.benchmarkReturn.toFixed(2)}%
            </span>
          ) : "—"}
        </td>
        <td className={cn("px-3 py-3 text-sm font-semibold tabular-nums",
          strat.alpha == null ? "text-muted-foreground"
          : strat.alpha > 0 ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-500"
        )}>
          {strat.alpha != null ? `${strat.alpha > 0 ? "+" : ""}${strat.alpha.toFixed(2)}%` : "—"}
        </td>
        <td className="px-3 py-3 text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
          {sortedPicks[0]?.return != null
            ? `${sortedPicks[0].ticker} ${sortedPicks[0].return >= 0 ? "+" : ""}${sortedPicks[0].return.toFixed(1)}%`
            : "—"}
        </td>
        <td className="px-3 py-3 text-sm tabular-nums text-red-500">
          {sortedPicks[sortedPicks.length - 1]?.return != null
            ? `${sortedPicks[sortedPicks.length - 1].ticker} ${sortedPicks[sortedPicks.length - 1].return!.toFixed(1)}%`
            : "—"}
        </td>
        <td className="pl-3 pr-5 py-3 text-right text-muted-foreground">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="border-t border-border/50 bg-muted/20 px-5 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider">
                    <th className="py-1.5 text-left font-medium">Action</th>
                    <th className="py-1.5 text-right font-medium">Prix entrée</th>
                    <th className="py-1.5 text-right font-medium">Prix sortie</th>
                    <th className="py-1.5 text-right font-medium">Rendement</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPicks.map((pick) => (
                    <tr key={pick.ticker} className="border-t border-border/30">
                      <td className="py-1.5 font-mono font-medium">{pick.ticker}</td>
                      <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                        {pick.entryPrice != null ? pick.entryPrice.toFixed(2) : "—"}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                        {pick.exitPrice != null ? pick.exitPrice.toFixed(2) : "—"}
                      </td>
                      <td className={cn("py-1.5 text-right font-semibold tabular-nums",
                        pick.return == null ? "text-muted-foreground"
                        : pick.return >= 0 ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500"
                      )}>
                        {pick.return != null ? `${pick.return >= 0 ? "+" : ""}${pick.return.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PerformanceHistory({ strategyId }: { strategyId: string }) {
  const { data, loading } = usePicksHistory()

  if (loading) return null

  if (!data || data.entries.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Suivi de performance.</span>{" "}
        Les rendements mensuels seront calculés automatiquement à partir du prochain rééquilibrage.
      </div>
    )
  }

  const relevantEntries = data.entries.filter((e) => e.strategies[strategyId])
  if (relevantEntries.length === 0) return null

  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <div className="px-5 py-3 border-b">
        <p className="text-sm font-semibold">Historique des performances</p>
        <p className="text-xs text-muted-foreground">Rendement equal-weighted mensuel · Calcul J+30 après sélection</p>
      </div>
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wider">
            <th className="pl-5 pr-3 py-2.5 text-left font-medium">Période</th>
            <th className="px-3 py-2.5 text-left font-medium">Portefeuille</th>
            <th className="px-3 py-2.5 text-left font-medium">Benchmark</th>
            <th className="px-3 py-2.5 text-left font-medium">Alpha</th>
            <th className="px-3 py-2.5 text-left font-medium">Meilleur pick</th>
            <th className="px-3 py-2.5 text-left font-medium">Pire pick</th>
            <th className="pl-3 pr-5 py-2.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {relevantEntries.map((entry) => (
            <PerfRow key={entry.period} entry={entry} strategyId={strategyId} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PicksDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading } = usePicks()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const strategy = useMemo(
    () => data?.strategies.find((s) => s.id === id) ?? null,
    [data, id],
  )

  const toggle = (ticker: string) =>
    setExpanded((prev) => ({ ...prev, [ticker]: !prev[ticker] }))

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-6 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (!data) return null
  if (!strategy) return <Navigate to="/picks" replace />

  const newCount = strategy.picks.filter((p) => p.isNew).length

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        to="/picks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Toutes les stratégies
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground text-sm">
              {MARKET_FLAG[strategy.market]} {strategy.marketLabel}
            </span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="outline" className="text-[10px]">Algorithme</Badge>
            <Badge variant="outline" className="text-[10px]">vs {strategy.benchmarkName}</Badge>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {strategy.emoji} {strategy.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{strategy.description}</p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 text-right shrink-0">
          <p>
            {strategy.picks.length} sélections · Pondération égale ({(100 / strategy.picks.length).toFixed(0)}% chacune)
          </p>
          {newCount > 0 && (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">
              {newCount} nouvelle{newCount > 1 ? "s" : ""} entrée{newCount > 1 ? "s" : ""} ce mois
            </p>
          )}
          {strategy.exits.length > 0 && (
            <p className="text-muted-foreground">
              Sorties : {strategy.exits.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wider">
              <th className="pl-5 pr-3 py-3 text-left font-medium w-8">#</th>
              <th className="px-3 py-3 text-left font-medium">Action</th>
              <th className="px-3 py-3 text-left font-medium">Score</th>
              <th className="px-3 py-3 text-right font-medium">Poids</th>
              <th className="px-3 py-3 text-right font-medium">P/E</th>
              <th className="px-3 py-3 text-right font-medium">ROE</th>
              <th className="px-3 py-3 text-right font-medium">Perf 6M</th>
              <th className="px-3 py-3 text-right font-medium">Div.</th>
              <th className="px-3 py-3 text-right font-medium">Cours</th>
              <th className="pl-3 pr-5 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {strategy.picks.map((pick) => (
              <PickRow
                key={pick.ticker}
                pick={pick}
                expanded={!!expanded[pick.ticker]}
                onToggle={() => toggle(pick.ticker)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Performance history */}
      <PerformanceHistory strategyId={strategy.id} />

      {/* Methodology note */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <span className="font-medium text-foreground">Méthodologie Rule-Based.</span>{" "}
            Chaque action est notée de 0 à 10 sur six piliers (valorisation, qualité, croissance, santé financière,
            dividende, momentum). Le score composite de cette stratégie pondère chaque pilier selon son objectif.
            Rééquilibrage mensuel le 1er de chaque mois.
          </p>
          <p>
            AlphaPicks est un outil de recherche algorithmique à titre informatif. Les sélections ne constituent
            pas un conseil en investissement personnalisé au sens de la Directive MiFID II. Les performances
            passées ne préjugent pas des performances futures.
          </p>
        </div>
      </div>

      {/* Stock page links */}
      <div className="flex flex-wrap gap-2">
        {strategy.picks.map((p) => (
          <Link
            key={p.ticker}
            to={`/stock/${p.ticker}`}
            className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            {p.ticker}
            <ExternalLink className="size-2.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
