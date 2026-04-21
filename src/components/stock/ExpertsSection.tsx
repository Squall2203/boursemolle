import { ExternalLink, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useStockNews } from "@/hooks/useStockNews"
import type { NewsArticle, TickerNews } from "@/types/news"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(diff / 86400000)
  if (days === 1) return "hier"
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return "il y a 1 semaine"
  if (weeks < 5) return `il y a ${weeks} semaines`
  const months = Math.floor(days / 30)
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`
}

function isStale(isoDate: string): boolean {
  return Date.now() - new Date(isoDate).getTime() > 48 * 3600000
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────

type Sentiment = "positif" | "négatif" | "neutre"

function SentimentBadge({
  sentiment,
  score,
  size = "sm",
}: {
  sentiment: Sentiment
  score?: number
  size?: "sm" | "lg"
}) {
  const config = {
    positif: {
      icon: <TrendingUp className={size === "lg" ? "size-4" : "size-3"} />,
      label: "Positif",
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    négatif: {
      icon: <TrendingDown className={size === "lg" ? "size-4" : "size-3"} />,
      label: "Négatif",
      cls: "bg-destructive/10 text-destructive border-destructive/20",
    },
    neutre: {
      icon: <Minus className={size === "lg" ? "size-4" : "size-3"} />,
      label: "Neutre",
      cls: "bg-muted text-muted-foreground border-border",
    },
  }[sentiment]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 font-medium",
        size === "lg" ? "py-1 text-xs" : "py-0.5 text-[10px]",
        config.cls,
      )}
    >
      {config.icon}
      {config.label}
      {score !== undefined && size === "lg" && (
        <span className="opacity-60 ml-0.5">{score > 0 ? "+" : ""}{score.toFixed(2)}</span>
      )}
    </span>
  )
}

// ─── Aggregate sentiment bar ──────────────────────────────────────────────────

function SentimentSummary({ news }: { news: TickerNews }) {
  const total = news.articles.length
  if (total === 0) return null
  const pos = news.articles.filter((a) => a.sentiment === "positif").length
  const neg = news.articles.filter((a) => a.sentiment === "négatif").length
  const neu = total - pos - neg

  return (
    <div className="flex items-center gap-3">
      <SentimentBadge sentiment={news.sentiment_label} score={news.sentiment_score} size="lg" />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="text-emerald-400 font-medium">{pos}↑</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{neu}—</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-destructive font-medium">{neg}↓</span>
        <span className="ml-1">sur {total} article{total > 1 ? "s" : ""}</span>
      </div>
      {isStale(news.last_updated) && (
        <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="size-3" /> Données &gt; 48h
        </span>
      )}
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground select-none">
        {article.source.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground truncate max-w-[120px]">{article.source}</span>
          <span>·</span>
          <span>{timeAgo(article.published_at)}</span>
          <SentimentBadge sentiment={article.sentiment} />
        </div>
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </p>
        {article.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
        )}
      </div>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
    </a>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ExpertsSectionProps {
  ticker: string
  simple?: boolean
}

export function ExpertsSection({ ticker, simple = false }: ExpertsSectionProps) {
  const { data, loading } = useStockNews(ticker)

  const titleClass = cn(
    "font-semibold",
    simple ? "text-sm text-muted-foreground uppercase tracking-wider" : "text-lg",
  )

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className={titleClass}>Ce qu'en disent les experts</h2>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!data || data.articles.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className={titleClass}>Ce qu'en disent les experts</h2>
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aucune actualité récente disponible pour cette action.
          </CardContent>
        </Card>
      </section>
    )
  }

  const displayed = simple ? data.articles.slice(0, 3) : data.articles.slice(0, 5)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={titleClass}>Ce qu'en disent les experts</h2>
        <SentimentSummary news={data} />
      </div>
      <div className="space-y-2">
        {displayed.map((article, i) => (
          <ArticleCard key={`${article.url}-${i}`} article={article} />
        ))}
      </div>
      {!simple && data.articles.length > 5 && (
        <p className="text-xs text-center text-muted-foreground">
          +{data.articles.length - 5} article{data.articles.length - 5 > 1 ? "s" : ""} supplémentaire{data.articles.length - 5 > 1 ? "s" : ""}
        </p>
      )}
    </section>
  )
}
