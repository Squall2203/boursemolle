import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { AnnualFinancial } from "@/types/stock"

function formatLargeNumber(n: number | null): string {
  if (n == null) return "—"
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} Md`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)} M`
  return n.toLocaleString("fr-FR")
}

function yoyGrowth(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

interface GrowthHistoryTableProps {
  financials: AnnualFinancial[]
  currency: string
}

export function GrowthHistoryTable({ financials, currency }: GrowthHistoryTableProps) {
  if (financials.length < 2) return null

  const symbol = currency === "EUR" ? "€" : currency

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Année</TableHead>
            <TableHead className="text-right">CA ({symbol})</TableHead>
            <TableHead className="text-right">Δ CA</TableHead>
            <TableHead className="text-right">Résultat net ({symbol})</TableHead>
            <TableHead className="text-right">Δ RN</TableHead>
            <TableHead className="text-right">Marge nette</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {financials.map((f, i) => {
            const prev = i > 0 ? financials[i - 1] : null
            const revGrowth = prev ? yoyGrowth(f.revenue, prev.revenue) : null
            const niGrowth = prev ? yoyGrowth(f.netIncome, prev.netIncome) : null
            const margin =
              f.revenue != null && f.netIncome != null && f.revenue !== 0
                ? (f.netIncome / f.revenue) * 100
                : null

            return (
              <TableRow key={f.year}>
                <TableCell className="font-medium">{f.year}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatLargeNumber(f.revenue)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    revGrowth != null && revGrowth > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : revGrowth != null && revGrowth < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {revGrowth != null
                    ? `${revGrowth > 0 ? "+" : ""}${revGrowth.toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatLargeNumber(f.netIncome)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    niGrowth != null && niGrowth > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : niGrowth != null && niGrowth < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {niGrowth != null
                    ? `${niGrowth > 0 ? "+" : ""}${niGrowth.toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    margin != null && margin > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : margin != null && margin < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {margin != null ? `${margin.toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
