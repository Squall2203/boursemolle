import { ExternalLink, Play, FileText, Rss } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTickerFeed } from "@/hooks/useFeed"
import type { FeedItem, Platform } from "@/types/feed"

function PlatformIcon({ platform }: { platform: Platform }) {
  switch (platform) {
    case "youtube": return <Play className="size-3.5 text-red-500" />
    case "blog": return <FileText className="size-3.5 text-blue-500" />
    case "rss": return <Rss className="size-3.5 text-orange-500" />
  }
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "hier"
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return "il y a 1 semaine"
  if (weeks < 5) return `il y a ${weeks} semaines`
  const months = Math.floor(days / 30)
  if (months === 1) return "il y a 1 mois"
  return `il y a ${months} mois`
}

function ExpertCard({ item }: { item: FeedItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase">
          {item.sourceName.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlatformIcon platform={item.platform} />
            <span className="font-medium text-foreground truncate">{item.sourceName}</span>
            <span>·</span>
            <span>{timeAgo(item.publishedAt)}</span>
            {item.tier === 1 && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto shrink-0">Tier 1</Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          )}
        </div>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </div>
    </a>
  )
}

interface ExpertsSectionProps {
  ticker: string
  simple?: boolean
}

export function ExpertsSection({ ticker, simple = false }: ExpertsSectionProps) {
  const { items, loading } = useTickerFeed(ticker)

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className={cn("font-semibold", simple ? "text-sm text-muted-foreground uppercase tracking-wider" : "text-lg")}>
          Ce qu'en disent les experts
        </h2>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      </section>
    )
  }

  const displayed = simple ? items.slice(0, 3) : items.slice(0, 5)

  if (displayed.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className={cn("font-semibold", simple ? "text-sm text-muted-foreground uppercase tracking-wider" : "text-lg")}>
          Ce qu'en disent les experts
        </h2>
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aucune mention récente de cette action dans les 3 derniers mois.
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className={cn("font-semibold", simple ? "text-sm text-muted-foreground uppercase tracking-wider" : "text-lg")}>
        Ce qu'en disent les experts
      </h2>
      <div className="space-y-2">
        {displayed.map((item) => (
          <ExpertCard key={item.id} item={item} />
        ))}
      </div>
      {!simple && items.length > 5 && (
        <p className="text-xs text-center text-muted-foreground">
          {items.length - 5} mention{items.length - 5 > 1 ? "s" : ""} supplémentaire{items.length - 5 > 1 ? "s" : ""} disponible{items.length - 5 > 1 ? "s" : ""}
        </p>
      )}
    </section>
  )
}
