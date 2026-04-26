import { useEffect, useRef } from "react"
import {
  createChart,
  type IChartApi,
  ColorType,
  CrosshairMode,
  LineSeries,
} from "lightweight-charts"
import type { PortfolioSnapshot } from "@/hooks/usePortfolioSnapshots"
import { formatPercent } from "@/lib/format"

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[]
  initialCapital: number
}

export function PortfolioChart({ snapshots, initialCapital }: PortfolioChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || snapshots.length === 0) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'Geist Variable', system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(156, 163, 175, 0.06)" },
        horzLines: { color: "rgba(156, 163, 175, 0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(156, 163, 175, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(156, 163, 175, 0.2)",
        timeVisible: false,
      },
      localization: {
        priceFormatter: (price: number) =>
          `${price >= 0 ? "+" : ""}${price.toFixed(2)}%`,
      },
    })

    const lastReturn =
      snapshots[snapshots.length - 1]?.cumulative_return ??
      ((snapshots[snapshots.length - 1].total_value - initialCapital) / initialCapital) * 100
    const isPositive = lastReturn >= 0

    const series = chart.addSeries(LineSeries, {
      color: isPositive ? "#10b981" : "#ef4444",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`,
      },
      crosshairMarkerVisible: true,
      lastValueVisible: true,
    })

    series.setData(
      snapshots.map((s) => ({
        time: s.snapshot_date,
        value:
          s.cumulative_return ??
          ((s.total_value - initialCapital) / initialCapital) * 100,
      })),
    )

    // Baseline at 0%
    const baselineSeries = chart.addSeries(LineSeries, {
      color: "rgba(156, 163, 175, 0.3)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "custom", formatter: () => "" },
    })
    baselineSeries.setData(
      snapshots.map((s) => ({ time: s.snapshot_date, value: 0 })),
    )

    chart.timeScale().fitContent()
    chartRef.current = chart

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [snapshots, initialCapital])

  if (snapshots.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Les données de performance s'accumulent au fil des jours.
      </div>
    )
  }

  const lastReturn =
    snapshots[snapshots.length - 1]?.cumulative_return ??
    ((snapshots[snapshots.length - 1].total_value - initialCapital) / initialCapital) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold tabular-nums ${lastReturn >= 0 ? "text-emerald-600" : "text-red-500"}`}
        >
          {formatPercent(lastReturn, true)}
        </span>
        <span className="text-xs text-muted-foreground">depuis le début</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
