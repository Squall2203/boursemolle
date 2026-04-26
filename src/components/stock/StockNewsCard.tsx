import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStockNews } from "@/hooks/useStockNews"
import { cn } from "@/lib/utils"

const SENTIMENT_DOT: Record<string, string> = {
  positif: "bg-emerald-500",
  négatif: "bg-red-500",
  neutre: "bg-muted-foreground",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "Il y a moins d'1h"
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  return `Il y a ${d}j`
}

interface StockNewsCardProps {
  ticker: string
}

export function StockNewsCard({ ticker }: StockNewsCardProps) {
  const { data, loading } = useStockNews(ticker)

  if (loading) return null
  if (!data || data.articles.length === 0) return null

  const sentimentColor =
    data.sentiment_label === "positif"
      ? "text-emerald-600 dark:text-emerald-400"
      : data.sentiment_label === "négatif"
        ? "text-red-500"
        : "text-muted-foreground"

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Actualités récentes
          </CardTitle>
          <span className={cn("text-xs font-medium", sentimentColor)}>
            Sentiment {data.sentiment_label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.articles.slice(0, 5).map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  SENTIMENT_DOT[article.sentiment] ?? "bg-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                {article.summary && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {article.summary}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{article.source}</span>
                  <span>·</span>
                  <span>{timeAgo(article.published_at)}</span>
                </div>
              </div>
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
