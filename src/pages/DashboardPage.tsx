import { useMemo } from "react"
import { Link } from "react-router-dom"
import { TrendingUp, ExternalLink, Play, FileText, Rss, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useFeed } from "@/hooks/useFeed"
import { useStocks } from "@/hooks/useStocks"
import { computeScore } from "@/lib/scoring"
import type { FeedItem, Platform } from "@/types/feed"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "il y a moins d'1h"
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(diff / 86400000)
  if (days === 1) return "hier"
  if (days < 7) return `il y a ${days}j`
  const weeks = Math.floor(days / 7)
  return `il y a ${weeks} sem`
}

function PlatformIcon({ platform }: { platform: Platform }) {
  switch (platform) {
    case "youtube": return <Play className="size-3 text-red-500" />
    case "blog": return <FileText className="size-3 text-blue-500" />
    case "rss": return <Rss className="size-3 text-orange-500" />
  }
}

// ─── Signaux du jour ──────────────────────────────────────────────────────────

const FLAG_PRIORITY = ["golden_cross", "aristos", "value_trap", "survendu", "surachete"]

function SignauxDuJour({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const signals = useMemo(() => {
    if (!stocks) return []
    const all = stocks.stocks
    const scores = all.map((s) => computeScore(s, all))

    const byFlag: Record<string, { label: string; emoji: string; color: string; tickers: string[] }> = {}

    for (let i = 0; i < all.length; i++) {
      for (const flag of scores[i].flags) {
        if (!byFlag[flag.id]) {
          byFlag[flag.id] = { label: flag.label, emoji: flag.emoji, color: flag.color, tickers: [] }
        }
        byFlag[flag.id].tickers.push(all[i].ticker)
      }
    }

    return Object.entries(byFlag)
      .sort((a, b) => FLAG_PRIORITY.indexOf(b[0]) - FLAG_PRIORITY.indexOf(a[0]))
      .slice(0, 6)
      .map(([id, data]) => ({ id, ...data }))
  }, [stocks])

  if (signals.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-4" />
          Signaux du jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {signals.map((sig) => (
          <Link
            key={sig.id}
            to={`/screener`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <Badge variant="outline" className={cn("gap-0.5 text-[10px] h-5 px-1.5 shrink-0", sig.color)}>
              {sig.emoji} {sig.label}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {sig.tickers.slice(0, 4).join(", ")}
              {sig.tickers.length > 4 && ` +${sig.tickers.length - 4}`}
            </span>
            <ChevronRight className="size-3.5 ml-auto shrink-0 text-muted-foreground" />
          </Link>
        ))}
        <Link
          to="/screener"
          className="block text-center text-xs text-primary hover:underline pt-1"
        >
          → Ouvrir le screener
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── Flux experts ─────────────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold uppercase">
        {item.sourceName.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
          <PlatformIcon platform={item.platform} />
          <span className="font-medium">{item.sourceName}</span>
          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
        <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </p>
        {item.tickers.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {item.tickers.slice(0, 3).map((t) => (
              <Link
                key={t}
                to={`/stock/${t}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] font-mono bg-muted px-1 rounded hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
    </a>
  )
}

// ─── Top actions ──────────────────────────────────────────────────────────────

function TopActions({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const top = useMemo(() => {
    if (!stocks) return []
    const all = stocks.stocks
    return all
      .map((s) => ({ stock: s, score: computeScore(s, all) }))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 5)
  }, [stocks])

  if (top.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top actions du moment
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y pb-2">
        {top.map(({ stock, score }) => (
          <Link
            key={stock.ticker}
            to={`/stock/${stock.ticker}`}
            className="flex items-center gap-3 py-2 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
          >
            <div className="w-20 truncate font-mono text-xs font-medium">{stock.ticker}</div>
            <div className="flex-1 truncate text-xs text-muted-foreground">{stock.name}</div>
            <div className={cn("text-xs font-semibold tabular-nums", score.labelColor)}>
              {score.total.toFixed(1)}
            </div>
            <div className={cn("text-[10px]", score.total >= 7 ? "text-emerald-600" : score.total >= 5 ? "text-yellow-600" : "text-red-500")}>
              {score.total >= 9 ? "A+" : score.total >= 8 ? "A" : score.total >= 7 ? "B+" : score.total >= 6 ? "B" : score.total >= 5 ? "C" : "D"}
            </div>
          </Link>
        ))}
        <Link to="/screener" className="block pt-2 text-center text-xs text-primary hover:underline">
          Voir toutes les actions →
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: feedData, loading: feedLoading } = useFeed()
  const { data: stocksData, loading: stocksLoading } = useStocks()

  const recentFeedItems = useMemo(() => {
    if (!feedData) return []
    return feedData.items
      .filter((i) => i.tier <= 2)
      .slice(0, 8)
  }, [feedData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bourse Molle</h1>
        <p className="text-sm text-muted-foreground">
          Votre veille bourse quotidienne — actions européennes, experts FR, données fondamentales
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Colonne principale */}
        <div className="space-y-6">
          {/* Flux experts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Flux experts</span>
                {feedData && (
                  <span className="text-[10px] normal-case font-normal">
                    {feedData.items.length} contenus · mis à jour {timeAgo(feedData.generatedAt)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {feedLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Chargement...</p>
              ) : recentFeedItems.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Aucun contenu disponible.</p>
                  <p className="text-xs text-muted-foreground">
                    Lancez <code className="bg-muted px-1 rounded text-xs">pnpm ingest-feed</code> pour agréger les contenus.
                  </p>
                </div>
              ) : (
                <div className="divide-y -mx-2">
                  {recentFeedItems.map((item) => (
                    <FeedCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {!stocksLoading && <SignauxDuJour stocks={stocksData} />}
          <Separator className="lg:hidden" />
          {!stocksLoading && <TopActions stocks={stocksData} />}
        </div>
      </div>
    </div>
  )
}
