import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStocks } from "@/hooks/useStocks"
import { getFreshness } from "@/lib/freshness"

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  )
}

export function DataFreshnessPage() {
  const { data, loading } = useStocks()
  const allStocks = useMemo(() => data?.stocks ?? [], [data])

  const stats = useMemo(() => {
    let green = 0, yellow = 0, orange = 0, red = 0, missing = 0
    for (const s of allStocks) {
      const info = getFreshness(s.lastFundamentalsUpdate ?? s.fetchedAt)
      if (!info) { missing++; continue }
      if (info.level === "green") green++
      else if (info.level === "yellow") yellow++
      else if (info.level === "orange") orange++
      else red++
    }
    return { green, yellow, orange, red, missing, total: allStocks.length }
  }, [allStocks])

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">État des données</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transparence sur la fraîcheur des données fondamentales.{" "}
          <Link to="/methodologie" className="underline hover:text-foreground">Voir la méthodologie</Link>
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Résumé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Univers total</span>
                <span className="font-semibold">{stats.total} actions</span>
              </div>
              {generatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernière mise à jour</span>
                  <span className="font-semibold">{generatedAt}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-semibold">Yahoo Finance</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Ancienneté des fondamentaux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "🟢 Moins de 3 jours", count: stats.green, color: "bg-emerald-500" },
                { label: "🟡 3 à 7 jours", count: stats.yellow, color: "bg-yellow-500" },
                { label: "🟠 7 à 14 jours", count: stats.orange, color: "bg-orange-500" },
                { label: "🔴 Plus de 14 jours", count: stats.red, color: "bg-red-500" },
              ].map(({ label, count, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">{count} actions</span>
                  </div>
                  <ProgressBar value={count} max={stats.total} color={color} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Couverture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Prix de clôture", pct: 100, note: "Quotidien ✅" },
                { label: "Indicateurs techniques", pct: 100, note: "Quotidien ✅" },
                {
                  label: "Fondamentaux détaillés",
                  pct: stats.total > 0 ? Math.round(((stats.green + stats.yellow + stats.orange) / stats.total) * 100) : 0,
                  note: "Cycle rotatif ⚠️",
                },
              ].map(({ label, pct, note }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between">
                    <span>{label}</span>
                    <span className="text-muted-foreground text-xs">{note}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
