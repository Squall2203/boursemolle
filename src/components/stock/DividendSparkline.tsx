import { useMemo } from "react"
import type { AnnualDividend } from "@/types/stock"

interface DividendSparklineProps {
  dividends: AnnualDividend[]
  currency: string
}

export function DividendSparkline({ dividends, currency }: DividendSparklineProps) {
  if (dividends.length < 2) return null

  const symbol = currency === "EUR" ? "€" : currency

  const { bars, maxTotal } = useMemo(() => {
    const maxTotal = Math.max(...dividends.map((d) => d.total))
    const bars = dividends.map((d) => ({
      year: d.year,
      total: d.total,
      height: maxTotal > 0 ? (d.total / maxTotal) * 100 : 0,
    }))
    return { bars, maxTotal }
  }, [dividends])

  if (maxTotal === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {bars.map((b) => (
          <div
            key={b.year}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            <div className="absolute -top-6 hidden rounded bg-popover px-1.5 py-0.5 text-xs font-medium shadow-sm group-hover:block">
              {b.total.toFixed(2)} {symbol}
            </div>
            <div
              className="w-full rounded-t bg-emerald-500/70 transition-colors group-hover:bg-emerald-500"
              style={{
                height: `${Math.max(b.height, 2)}%`,
                minHeight: 2,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {bars.map((b) => (
          <div
            key={b.year}
            className="flex-1 text-center text-[10px] tabular-nums text-muted-foreground"
          >
            {b.year}
          </div>
        ))}
      </div>
    </div>
  )
}
