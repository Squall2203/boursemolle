import type { EnrichedPosition } from "./PositionsTable"

interface PortfolioAnalysisProps {
  positions: EnrichedPosition[]
  totalValue: number
  cashBalance: number
}

export function PortfolioAnalysis({ positions, totalValue, cashBalance }: PortfolioAnalysisProps) {
  if (positions.length === 0) return null

  const sorted = [...positions].sort((a, b) => b.valueEur - a.valueEur)
  const top3Weight = sorted.slice(0, 3).reduce((s, p) => s + p.weight, 0)

  const sectors: Record<string, number> = {}
  for (const p of positions) {
    if (p.stock?.sector) {
      sectors[p.stock.sector] = (sectors[p.stock.sector] ?? 0) + p.weight
    }
  }
  const sectorCount = Object.keys(sectors).length

  const divYield =
    positions
      .filter((p) => p.stock?.dividendYield)
      .reduce((s, p) => s + (p.stock!.dividendYield! * p.weight) / 100, 0) * 100

  const cashWeight = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0

  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold">Analyse du portefeuille</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <AnalysisRow
          label="Concentration top 3"
          value={`${top3Weight.toFixed(0)}%`}
          status={top3Weight > 60 ? "warn" : top3Weight > 40 ? "caution" : "ok"}
          hint={top3Weight > 60 ? "Très concentré" : top3Weight > 40 ? "Recommandé < 40%" : "Bien diversifié"}
        />
        <AnalysisRow
          label="Secteurs représentés"
          value={`${sectorCount} / 11`}
          status={sectorCount < 3 ? "warn" : sectorCount < 5 ? "caution" : "ok"}
          hint={sectorCount < 3 ? "Trop peu de secteurs" : sectorCount < 5 ? "Diversification partielle" : "Bonne diversification"}
        />
        <AnalysisRow
          label="Rendement div. estimé"
          value={divYield > 0 ? `${divYield.toFixed(1)}%` : "—"}
          status="neutral"
        />
        <AnalysisRow
          label="Cash disponible"
          value={`${cashWeight.toFixed(0)}%`}
          status={cashWeight > 50 ? "caution" : "neutral"}
          hint={cashWeight > 50 ? "Capital sous-investi" : undefined}
        />
      </div>
    </div>
  )
}

function AnalysisRow({
  label,
  value,
  status,
  hint,
}: {
  label: string
  value: string
  status: "ok" | "caution" | "warn" | "neutral"
  hint?: string
}) {
  const icon =
    status === "ok" ? "✅" : status === "warn" ? "⚠️" : status === "caution" ? "⚠️" : null

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <div>
        <span className="text-muted-foreground">{label}</span>
        {hint && <div className="text-xs text-muted-foreground/70">{hint}</div>}
      </div>
      <span className="shrink-0 font-medium">
        {icon && <span className="mr-1 text-xs">{icon}</span>}
        {value}
      </span>
    </div>
  )
}
