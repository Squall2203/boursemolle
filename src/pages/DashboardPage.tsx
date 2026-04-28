import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Sparkles, BarChart2, Star, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStocks } from "@/hooks/useStocks"
import { useMacro, type MacroItem, type MacroData } from "@/hooks/useMacro"
import { computeScore } from "@/lib/scoring"
import { getStockRegion } from "@/lib/market"

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

function TickerTape({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const [paused, setPaused] = useState(false)

  const items = useMemo(() => {
    if (!stocks) return []
    return [...stocks.stocks]
      .filter((s) => {
        const r = getStockRegion(s)
        return (r === "eu" || r === "us") && s.price != null && s.name
      })
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, 22)
  }, [stocks])

  if (items.length === 0) return null
  const doubled = [...items, ...items]

  return (
    <div
      className="relative overflow-hidden border-b border-border bg-primary/[0.03] h-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
      <div
        className="flex h-full items-center"
        style={{
          width: "max-content",
          animation: "ticker-scroll 50s linear infinite",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {doubled.map((s, i) => (
          <Link
            key={`${s.ticker}-${i}`}
            to={`/stock/${s.ticker}`}
            className="inline-flex items-center gap-2 px-5 whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            <span className="text-[13px] font-medium text-muted-foreground">{s.name}</span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">
              {s.price?.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {" "}{s.currency === "EUR" ? "€" : s.currency === "USD" ? "$" : s.currency}
            </span>
            {s.priceChangePercent != null && (
              <span className={cn(
                "font-mono text-[12px] font-medium tabular-nums",
                s.priceChangePercent >= 0 ? "text-emerald-500" : "text-destructive"
              )}>
                {s.priceChangePercent >= 0 ? "+" : ""}{s.priceChangePercent.toFixed(2)}%
              </span>
            )}
            <span className="inline-block w-[3px] h-[3px] rounded-full bg-muted-foreground/30 ml-1" />
          </Link>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ─── Signal Grid ──────────────────────────────────────────────────────────────

function signalIconBg(colorClass: string) {
  if (colorClass.includes("yellow")) return "bg-yellow-500/10"
  if (colorClass.includes("blue"))   return "bg-blue-500/10"
  if (colorClass.includes("red"))    return "bg-red-500/10"
  if (colorClass.includes("orange")) return "bg-orange-500/10"
  return "bg-emerald-500/10"
}

function SignalGrid({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const signals = useMemo(() => {
    if (!stocks) return []
    const all = stocks.stocks
    const byFlag: Record<string, { label: string; emoji: string; color: string; tickers: string[] }> = {}
    for (const s of all) {
      for (const flag of computeScore(s, all).flags) {
        if (!byFlag[flag.id])
          byFlag[flag.id] = { label: flag.label, emoji: flag.emoji, color: flag.color, tickers: [] }
        byFlag[flag.id].tickers.push(s.ticker)
      }
    }
    return Object.entries(byFlag).slice(0, 6).map(([id, data]) => ({ id, ...data }))
  }, [stocks])

  if (signals.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          ⚡ Signaux du jour
        </span>
        <Link to="/screener" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Ouvrir le screener →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {signals.map((sig) => {
          const shown = sig.tickers.slice(0, 4)
          const extra = sig.tickers.length - shown.length
          return (
            <Link
              key={sig.id}
              to="/screener"
              className="rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:bg-muted/20 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-[14px]", signalIconBg(sig.color))}>
                  {sig.emoji}
                </div>
                <span className="text-[12px] font-semibold leading-tight">{sig.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{sig.tickers.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {shown.map((t) => (
                  <span key={t} className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {t}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    +{extra}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Top Scores Table ─────────────────────────────────────────────────────────

function TopScoresTable({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          🏆 Top scores du jour
        </span>
        <Link to="/screener" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Voir tout →
        </Link>
      </div>
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_88px_62px_52px] px-4 py-2 border-b border-border bg-muted/30">
          {["Action", "Prix", "Var.", "Score"].map((h, i) => (
            <span key={h} className={cn("text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", i > 0 && "text-right", i === 3 && "text-center")}>
              {h}
            </span>
          ))}
        </div>
        {top.map(({ stock: s, score }) => (
          <Link
            key={s.ticker}
            to={`/stock/${s.ticker}`}
            className="grid grid-cols-[1fr_88px_62px_52px] px-4 py-2.5 items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate leading-tight">{s.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.ticker}</div>
            </div>
            <div className="font-mono text-[12px] text-muted-foreground text-right tabular-nums">
              {s.price != null
                ? `${s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.currency === "EUR" ? "€" : s.currency === "USD" ? "$" : ""}`
                : "—"}
            </div>
            <div className={cn(
              "font-mono text-[12px] font-medium text-right tabular-nums",
              (s.priceChangePercent ?? 0) >= 0 ? "text-emerald-500" : "text-destructive"
            )}>
              {s.priceChangePercent != null
                ? `${s.priceChangePercent >= 0 ? "+" : ""}${s.priceChangePercent.toFixed(2)}%`
                : "—"}
            </div>
            <div className="flex justify-center">
              <span className={cn(
                "font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums",
                score.total >= 8
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : score.total >= 6
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}>
                {score.total.toFixed(1)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Movers Card ─────────────────────────────────────────────────────────────

function MoversCard({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const [tab, setTab] = useState<"up" | "down">("up")

  const { gainers, losers } = useMemo(() => {
    if (!stocks) return { gainers: [], losers: [] }
    const withChange = stocks.stocks.filter((s) => s.priceChangePercent != null && s.price != null)
    const sorted = [...withChange].sort((a, b) => b.priceChangePercent! - a.priceChangePercent!)
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() }
  }, [stocks])

  const list = tab === "up" ? gainers : losers
  if (gainers.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Movers du jour
      </span>
      <div className="flex gap-0 mt-3 mb-3 rounded-lg bg-muted p-0.5">
        {(["up", "down"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-[12px] font-semibold transition-all",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "up" ? "Hausses" : "Baisses"}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border">
        {list.map((s) => (
          <Link
            key={s.ticker}
            to={`/stock/${s.ticker}`}
            className="flex items-center justify-between py-2 hover:opacity-70 transition-opacity"
          >
            <div>
              <div className="text-[13px] font-medium leading-tight">{s.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.ticker}</div>
            </div>
            <span className={cn(
              "font-mono text-[13px] font-semibold tabular-nums",
              tab === "up" ? "text-emerald-500" : "text-destructive"
            )}>
              {tab === "up" ? "+" : ""}{s.priceChangePercent!.toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── AlphaPicks CTA ───────────────────────────────────────────────────────────

function AlphaPicksCTA({ stocks }: { stocks: ReturnType<typeof useStocks>["data"] }) {
  const topPicks = useMemo(() => {
    if (!stocks) return []
    const all = stocks.stocks
    return all
      .map((s) => ({ stock: s, score: computeScore(s, all) }))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 3)
  }, [stocks])

  return (
    <Link
      to="/picks"
      className="block rounded-xl border border-primary/15 p-5 text-center hover:border-primary/30 hover:-translate-y-0.5 transition-all bg-gradient-to-br from-emerald-500/5 to-blue-500/5 dark:from-emerald-500/8 dark:to-blue-500/8"
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
        <Sparkles className="size-3" /> Nouveau
      </div>
      <h3 className="font-heading text-[18px] font-semibold mb-1.5">AlphaPicks</h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
        Sélections algorithmiques mensuelles. 5 stratégies, recalculées chaque mois.
      </p>
      {topPicks.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {topPicks.map(({ stock, score }) => (
            <span
              key={stock.ticker}
              className="font-mono text-[10px] border border-border rounded-md px-2 py-1 text-muted-foreground bg-background/60"
            >
              {stock.ticker} {score.total.toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

// ─── Macro Card ───────────────────────────────────────────────────────────────

type MacroType = "index" | "forex" | "commodity" | "yield"

function formatMacroValue(item: MacroItem, type: MacroType): string {
  if (type === "index")     return item.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
  if (type === "forex")     return item.value.toFixed(4)
  if (type === "commodity") return `${item.value.toFixed(2)} $`
  return `${item.value.toFixed(2)} %`
}

const MACRO_CONFIG: Array<{ key: keyof MacroData; label: string; type: MacroType }> = [
  { key: "cac40",  label: "CAC 40",    type: "index" },
  { key: "sp500",  label: "S&P 500",   type: "index" },
  { key: "eurusd", label: "EUR/USD",   type: "forex" },
  { key: "brent",  label: "Brent",     type: "commodity" },
  { key: "us10y",  label: "US 10Y",    type: "yield" },
  { key: "bce",    label: "Taux BCE",  type: "yield" },
]

function MacroCard() {
  const { data } = useMacro()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Contexte macro
      </span>
      <div className="mt-3 divide-y divide-border">
        {MACRO_CONFIG.map(({ key, label, type }) => {
          const item = data?.[key] as MacroItem | null | undefined
          const hasChange = item && !item.static && item.changePercent !== 0
          return (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-[13px] text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                {hasChange && (
                  <span className={cn(
                    "font-mono text-[10px] tabular-nums",
                    item.changePercent >= 0 ? "text-emerald-500" : "text-destructive"
                  )}>
                    {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                  </span>
                )}
                <span className={cn(
                  "font-mono text-[12px] font-medium tabular-nums",
                  item
                    ? (hasChange
                        ? item.changePercent >= 0 ? "text-emerald-500" : "text-destructive"
                        : "text-foreground")
                    : "text-muted-foreground/40"
                )}>
                  {item ? formatMacroValue(item, type) : "—"}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Features Strip ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <BarChart2 className="size-5" />,
    bg: "bg-primary/10 text-primary",
    title: "Screener intelligent",
    desc: "Filtrez par score, secteur, capitalisation, dividende, momentum et 30+ critères combinables.",
    href: "/screener",
  },
  {
    icon: <Star className="size-5" />,
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Score /10 par action",
    desc: "7 piliers calibrés par secteur. Méthodologie 100% transparente et publique.",
    href: "/methodologie",
  },
  {
    icon: <Target className="size-5" />,
    bg: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    title: "Paper PEA",
    desc: "Investissez 100K€ virtuels. Suivez vos performances vs le marché. Progressez.",
    href: "/portfolio",
  },
]

function FeaturesStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {FEATURES.map((f) => (
        <Link
          key={f.title}
          to={f.href}
          className="rounded-xl border border-border bg-card p-5 hover:border-border/80 hover:-translate-y-0.5 transition-all"
        >
          <div className={cn("mb-3 flex size-10 items-center justify-center rounded-xl", f.bg)}>
            {f.icon}
          </div>
          <h4 className="font-heading text-[15px] font-semibold mb-1.5">{f.title}</h4>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
        </Link>
      ))}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: stocksData, loading } = useStocks()

  const stats = useMemo(() => {
    if (!stocksData) return null
    const updated = stocksData.generatedAt
      ? new Date(stocksData.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
      : null
    return { count: stocksData.count, updated }
  }, [stocksData])

  return (
    <div className="space-y-0">
      {/* Ticker tape — déborde du padding de la main */}
      {!loading && (
        <div className="-mx-4 sm:-mx-6 mb-8">
          <TickerTape stocks={stocksData} />
        </div>
      )}

      {/* Hero */}
      <section className="pb-2 space-y-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          📊 Analyse boursière
        </div>
        <h1 className="font-display text-[40px] leading-[1.15] tracking-tight max-w-lg">
          L'investissement simplifié, sans le bruit.
        </h1>
        <p className="text-[17px] text-muted-foreground leading-relaxed max-w-lg">
          Scores, signaux et sélections algorithmiques pour investisseurs long terme — marchés européens et américains.
        </p>
        {stats && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span><span className="font-mono font-semibold text-foreground">{stats.count}</span> actions</span>
            <span className="text-muted-foreground/30">·</span>
            <span><span className="font-mono font-semibold text-foreground">7</span> axes de scoring</span>
            <span className="text-muted-foreground/30">·</span>
            <span>Données du <span className="font-semibold text-foreground">{stats.updated}</span></span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            to="/screener"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground hover:opacity-90 hover:-translate-y-px transition-all"
          >
            Ouvrir le screener <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/methodologie"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Voir la méthodologie
          </Link>
        </div>
      </section>

      {/* Main grid 2 colonnes */}
      <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-[1fr_320px]">
        {/* Colonne gauche : signaux + top scores */}
        <div className="space-y-6">
          {!loading && <SignalGrid stocks={stocksData} />}
          {!loading && <TopScoresTable stocks={stocksData} />}
        </div>

        {/* Sidebar droite : movers + alpha + macro */}
        <div className="space-y-4">
          {!loading && <MoversCard stocks={stocksData} />}
          {!loading && <AlphaPicksCTA stocks={stocksData} />}
          <MacroCard />
        </div>
      </div>

      {/* Features strip */}
      <div className="pt-8">
        <FeaturesStrip />
      </div>
    </div>
  )
}
