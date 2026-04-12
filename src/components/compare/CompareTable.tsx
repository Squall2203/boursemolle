import { cn } from "@/lib/utils"
import { formatMarketCap, formatPercent, formatRatio, formatPrice } from "@/lib/format"
import type { Stock } from "@/types/stock"

interface MetricDef {
  label: string
  getValue: (s: Stock) => number | null
  format: (n: number | null) => string
  higherIsBetter: boolean
}

const METRIC_GROUPS: Array<{ title: string; metrics: MetricDef[] }> = [
  {
    title: "Valorisation",
    metrics: [
      { label: "Prix", getValue: (s) => s.price, format: (n) => formatPrice(n), higherIsBetter: false },
      { label: "Capitalisation", getValue: (s) => s.marketCap, format: formatMarketCap, higherIsBetter: true },
      { label: "P/E (TTM)", getValue: (s) => s.trailingPE, format: formatRatio, higherIsBetter: false },
      { label: "P/E forward", getValue: (s) => s.forwardPE, format: formatRatio, higherIsBetter: false },
      { label: "EV/EBITDA", getValue: (s) => s.evToEbitda, format: formatRatio, higherIsBetter: false },
      { label: "P/B", getValue: (s) => s.priceToBook, format: formatRatio, higherIsBetter: false },
    ],
  },
  {
    title: "Profitabilité",
    metrics: [
      { label: "ROE", getValue: (s) => s.returnOnEquity, format: (n) => formatPercent(n), higherIsBetter: true },
      { label: "ROA", getValue: (s) => s.returnOnAssets, format: (n) => formatPercent(n), higherIsBetter: true },
      { label: "Marge nette", getValue: (s) => s.profitMargins, format: (n) => formatPercent(n), higherIsBetter: true },
      { label: "Marge opérationnelle", getValue: (s) => s.operatingMargins, format: (n) => formatPercent(n), higherIsBetter: true },
    ],
  },
  {
    title: "Croissance",
    metrics: [
      { label: "Croissance CA", getValue: (s) => s.revenueGrowth, format: (n) => formatPercent(n), higherIsBetter: true },
      { label: "Croissance BPA", getValue: (s) => s.earningsGrowth, format: (n) => formatPercent(n), higherIsBetter: true },
    ],
  },
  {
    title: "Dividendes",
    metrics: [
      { label: "Rendement", getValue: (s) => s.dividendYield, format: (n) => formatPercent(n), higherIsBetter: true },
      { label: "Payout ratio", getValue: (s) => s.payoutRatio, format: (n) => formatPercent(n), higherIsBetter: false },
    ],
  },
  {
    title: "Bilan",
    metrics: [
      { label: "Dette totale", getValue: (s) => s.totalDebt, format: formatMarketCap, higherIsBetter: false },
      { label: "Trésorerie", getValue: (s) => s.totalCash, format: formatMarketCap, higherIsBetter: true },
      { label: "Dette / Capitaux propres", getValue: (s) => s.debtToEquity, format: formatRatio, higherIsBetter: false },
    ],
  },
]

function findBestIndex(
  stocks: Stock[],
  getValue: (s: Stock) => number | null,
  higherIsBetter: boolean,
): number | null {
  let bestIdx: number | null = null
  let bestVal: number | null = null
  for (let i = 0; i < stocks.length; i++) {
    const v = getValue(stocks[i])
    if (v == null) continue
    if (
      bestVal == null ||
      (higherIsBetter ? v > bestVal : v < bestVal)
    ) {
      bestVal = v
      bestIdx = i
    }
  }
  return stocks.length > 1 ? bestIdx : null
}

interface CompareTableProps {
  stocks: Stock[]
}

export function CompareTable({ stocks }: CompareTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Métrique
            </th>
            {stocks.map((s) => (
              <th
                key={s.ticker}
                className="px-4 py-3 text-right font-mono font-semibold"
              >
                {s.ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_GROUPS.map((group) => (
            <>
              <tr key={group.title}>
                <td
                  colSpan={stocks.length + 1}
                  className="bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {group.title}
                </td>
              </tr>
              {group.metrics.map((metric) => {
                const bestIdx = findBestIndex(
                  stocks,
                  metric.getValue,
                  metric.higherIsBetter,
                )
                return (
                  <tr key={metric.label} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">
                      {metric.label}
                    </td>
                    {stocks.map((s, i) => (
                      <td
                        key={s.ticker}
                        className={cn(
                          "px-4 py-2 text-right font-mono tabular-nums",
                          i === bestIdx && "font-semibold text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {metric.format(metric.getValue(s))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
