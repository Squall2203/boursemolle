import { useMemo } from "react"
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown, ArrowRight, BarChart2, Star, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useStocks } from "@/hooks/useStocks"
import { computeScore } from "@/lib/scoring"
import { formatMarketCap, formatPercent } from "@/lib/format"

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

function TickerTape({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const items = useMemo(() => {
    if (!stocks) return []
    return [...stocks.stocks]
      .filter((s) => s.price != null)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, 24)
  }, [stocks])

  if (items.length === 0) return null

  const doubled = [...items, ...items]

  return (
    <div className="overflow-hidden border-b border-border bg-card py-3 text-sm">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker 80s linear infinite" }}
      >
        {doubled.map((s, i) => (
          <Link
            key={`${s.ticker}-${i}`}
            to={`/stock/${s.ticker}`}
            className="mx-10 inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="font-mono font-bold text-foreground">{s.ticker}</span>
            <span className="text-muted-foreground max-w-[140px] truncate">{s.name}</span>
            <span className="font-mono text-foreground">
              {s.price?.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-muted-foreground">{s.currency === "EUR" ? "€" : s.currency === "USD" ? "$" : s.currency}</span>
            </span>
            {s.priceChangePercent != null && (
              <span className={cn("font-mono font-medium", s.priceChangePercent >= 0 ? "text-emerald-500" : "text-destructive")}>
                {s.priceChangePercent >= 0 ? "▲" : "▼"}{Math.abs(s.priceChangePercent).toFixed(2)}%
              </span>
            )}
          </Link>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ─── Hero Stock Card ──────────────────────────────────────────────────────────

function HeroStockCard({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const top = useMemo(() => {
    if (!stocks) return null
    const all = stocks.stocks
    return all
      .map((s) => ({ stock: s, score: computeScore(s, all) }))
      .sort((a, b) => b.score.total - a.score.total)[0] ?? null
  }, [stocks])

  if (!top) return null
  const { stock: s, score } = top

  const scoreColor =
    score.total >= 8 ? "text-emerald-400" :
    score.total >= 6 ? "text-yellow-400" : "text-red-400"

  return (
    <Link
      to={`/stock/${s.ticker}`}
      className="group relative block rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-all hover:shadow-[0_0_20px_rgba(0,230,118,0.08)]"
    >
      <div className="absolute -top-3 left-5">
        <span className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wide">
          {score.label}
        </span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-mono mb-0.5">{s.ticker}</div>
          <div className="font-heading text-lg font-semibold leading-tight">{s.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{s.sector ?? ""} · {s.country}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-heading text-2xl font-bold tabular-nums">
            {s.price?.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-sm font-normal text-muted-foreground ml-1">{s.currency === "EUR" ? "€" : "$"}</span>
          </div>
          {s.priceChangePercent != null && (
            <div className={cn("text-sm font-medium", s.priceChangePercent >= 0 ? "text-emerald-500" : "text-destructive")}>
              {s.priceChangePercent >= 0 ? <TrendingUp className="inline size-3 mr-0.5" /> : <TrendingDown className="inline size-3 mr-0.5" />}
              {s.priceChangePercent >= 0 ? "+" : ""}{s.priceChangePercent.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 border-t border-border pt-4">
        {[
          { label: "Score", value: <span className={cn("font-bold", scoreColor)}>{score.total.toFixed(1)}</span> },
          { label: "P/E", value: s.trailingPE?.toFixed(1) ?? "—" },
          { label: "Dividende", value: s.dividendYield ? `${s.dividendYield.toFixed(1)}%` : "—" },
          { label: "Capitalisation", value: s.marketCap ? formatMarketCap(s.marketCap, s.currency) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
        Voir la fiche complète <ArrowRight className="size-3" />
      </div>
    </Link>
  )
}

// ─── Signaux du jour ──────────────────────────────────────────────────────────

function SignauxDuJour({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const signals = useMemo(() => {
    if (!stocks) return []
    const all = stocks.stocks
    const byFlag: Record<string, { label: string; emoji: string; color: string; tickers: string[] }> = {}
    for (const s of all) {
      for (const flag of computeScore(s, all).flags) {
        if (!byFlag[flag.id]) byFlag[flag.id] = { label: flag.label, emoji: flag.emoji, color: flag.color, tickers: [] }
        byFlag[flag.id].tickers.push(s.ticker)
      }
    }
    return Object.entries(byFlag).slice(0, 6).map(([id, data]) => ({ id, ...data }))
  }, [stocks])

  if (signals.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="size-4" /> Signaux du jour
      </h3>
      <div className="space-y-2">
        {signals.map((sig) => (
          <Link
            key={sig.id}
            to="/screener"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <Badge variant="outline" className={cn("gap-0.5 text-[10px] h-5 px-1.5 shrink-0", sig.color)}>
              {sig.emoji} {sig.label}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {sig.tickers.slice(0, 4).join(", ")}{sig.tickers.length > 4 ? ` +${sig.tickers.length - 4}` : ""}
            </span>
            <ArrowRight className="size-3 ml-auto shrink-0 text-muted-foreground" />
          </Link>
        ))}
        <Link to="/screener" className="block pt-1 text-center text-xs text-primary hover:underline">
          Ouvrir le screener →
        </Link>
      </div>
    </div>
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
      .slice(0, 7)
  }, [stocks])

  if (top.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Top actions
      </h3>
      <div className="divide-y divide-border">
        {top.map(({ stock, score }) => (
          <Link
            key={stock.ticker}
            to={`/stock/${stock.ticker}`}
            className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-muted/40 transition-colors"
          >
            <span className="w-20 shrink-0 font-mono text-xs font-semibold text-foreground">{stock.ticker}</span>
            <span className="flex-1 truncate text-sm text-muted-foreground">{stock.name}</span>
            {stock.priceChangePercent != null && (
              <span className={cn("text-xs tabular-nums w-14 text-right shrink-0", stock.priceChangePercent >= 0 ? "text-emerald-500" : "text-destructive")}>
                {stock.priceChangePercent >= 0 ? "+" : ""}{formatPercent(stock.priceChangePercent)}
              </span>
            )}
            <span className={cn("text-xs font-bold tabular-nums w-8 text-right shrink-0",
              score.total >= 8 ? "text-emerald-400" : score.total >= 6 ? "text-yellow-400" : "text-red-400"
            )}>
              {score.total.toFixed(1)}
            </span>
          </Link>
        ))}
      </div>
      <Link to="/screener" className="block mt-2 text-center text-xs text-primary hover:underline">
        Voir toutes les actions →
      </Link>
    </div>
  )
}

// ─── Top movers ───────────────────────────────────────────────────────────────

function TopMovers({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const { gainers, losers } = useMemo(() => {
    if (!stocks) return { gainers: [], losers: [] }
    const withChange = stocks.stocks.filter((s) => s.priceChangePercent != null && s.price != null)
    const sorted = [...withChange].sort((a, b) => b.priceChangePercent! - a.priceChangePercent!)
    return {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
    }
  }, [stocks])

  if (gainers.length === 0) return null

  const Row = ({ stock, isGainer }: { stock: (typeof gainers)[0]; isGainer: boolean }) => (
    <Link
      to={`/stock/${stock.ticker}`}
      className="flex items-center gap-2 py-1.5 -mx-2 px-2 rounded hover:bg-muted/40 transition-colors"
    >
      <span className="w-18 shrink-0 font-mono text-xs font-semibold">{stock.ticker}</span>
      <span className="flex-1 truncate text-xs text-muted-foreground">{stock.name}</span>
      <span className={cn("text-xs font-bold tabular-nums shrink-0", isGainer ? "text-emerald-500" : "text-destructive")}>
        {isGainer ? "+" : ""}{stock.priceChangePercent!.toFixed(2)}%
      </span>
    </Link>
  )

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Movers du jour
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Hausses</p>
          <div className="divide-y divide-border/50">
            {gainers.map((s) => <Row key={s.ticker} stock={s} isGainer={true} />)}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">Baisses</p>
          <div className="divide-y divide-border/50">
            {losers.map((s) => <Row key={s.ticker} stock={s} isGainer={false} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Features strip ───────────────────────────────────────────────────────────

function FeaturesStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[
        { icon: <BarChart2 className="size-5" />, title: "Screener intelligent", desc: "Filtrez par score, secteur, capitalisation, dividende, momentum et 30+ critères." },
        { icon: <Star className="size-5" />, title: "Score /10 par action", desc: "7 piliers (valorisation, qualité, croissance…) combinés en un seul score actionnable." },
        { icon: <Shield className="size-5" />, title: "Paper PEA", desc: "Investissez virtuellement sans risque. Suivez vos performances vs le marché." },
      ].map(({ icon, title, desc }) => (
        <div key={title} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <h4 className="font-heading font-semibold mb-1.5">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: stocksData, loading: stocksLoading } = useStocks()

  const stats = useMemo(() => {
    if (!stocksData) return null
    const updated = stocksData.generatedAt
      ? new Date(stocksData.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
      : null
    return { count: stocksData.count, updated }
  }, [stocksData])

  return (
    <div className="space-y-8">
      {/* Ticker tape */}
      {!stocksLoading && <div className="-mx-4 sm:-mx-6"><TickerTape stocks={stocksData} /></div>}

      {/* Hero */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Analyse boursière</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">
          L'investissement simplifié,{" "}
          <span className="text-primary">sans le bruit.</span>
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Screener, scores et signaux pour investisseurs long terme — marchés européens et américains.
        </p>
        {stats && (
          <p className="text-xs text-muted-foreground">
            {stats.count} actions · données du {stats.updated}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Link
            to="/screener"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Ouvrir le screener <ArrowRight className="size-4" />
          </Link>
          <Link to="/methodologie" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
            Voir la méthodologie
          </Link>
        </div>
      </div>

      {/* Hero card + side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {!stocksLoading && <HeroStockCard stocks={stocksData} />}
          <FeaturesStrip />
        </div>
        <div className="space-y-4">
          {!stocksLoading && <TopMovers stocks={stocksData} />}
          {!stocksLoading && <SignauxDuJour stocks={stocksData} />}
          {!stocksLoading && <TopActions stocks={stocksData} />}
        </div>
      </div>
    </div>
  )
}
