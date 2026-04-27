import { useEffect, useRef, useState } from "react"
import { createChart, type IChartApi, ColorType, CrosshairMode, LineSeries } from "lightweight-charts"
import { cn } from "@/lib/utils"
import type { StrategyChartData } from "@/types/picks"

const RANGES = ["6M", "1A"] as const
type Range = typeof RANGES[number]

function sliceToRange(points: { date: string; value: number }[], range: Range) {
  if (points.length === 0) return points
  const cutoff = new Date()
  if (range === "6M") cutoff.setMonth(cutoff.getMonth() - 6)
  else cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  const filtered = points.filter(p => p.date >= cutoffStr)
  if (filtered.length === 0) return points
  // rebase to 100 at new start
  const base = filtered[0].value
  return filtered.map(p => ({ date: p.date, value: Math.round((p.value / base) * 10000) / 100 }))
}

interface StrategyChartProps {
  chartData: StrategyChartData
  benchmarkName: string
  className?: string
}

export function StrategyChart({ chartData, benchmarkName, className }: StrategyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [range, setRange] = useState<Range>("1A")

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const portfolio = sliceToRange(chartData.portfolio, range)
    const benchmark = sliceToRange(chartData.benchmark, range)
    if (portfolio.length === 0) return

    const isDark = document.documentElement.classList.contains("dark")
    const textColor = isDark ? "#9ca3af" : "#6b7280"
    const gridColor = isDark ? "rgba(156,163,175,0.08)" : "rgba(0,0,0,0.06)"
    const borderColor = isDark ? "rgba(156,163,175,0.2)" : "rgba(0,0,0,0.1)"

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 240,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontFamily: "'Geist Variable', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor,
        timeVisible: false,
      },
      localization: {
        priceFormatter: (p: number) => `${p.toFixed(1)}`,
      },
    })

    const portfolioSeries = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}` },
    })
    portfolioSeries.setData(portfolio.map(p => ({ time: p.date, value: p.value })))

    if (benchmark.length > 0) {
      const benchSeries = chart.addSeries(LineSeries, {
        color: isDark ? "#6b7280" : "#9ca3af",
        lineWidth: 1,
        priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}` },
      })
      benchSeries.setData(benchmark.map(p => ({ time: p.date, value: p.value })))
    }

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
  }, [chartData, range])

  if (chartData.portfolio.length === 0) return null

  const lastPortfolio = chartData.portfolio[chartData.portfolio.length - 1]?.value ?? 100
  const lastBenchmark = chartData.benchmark[chartData.benchmark.length - 1]?.value ?? 100
  const portfolioReturn = Math.round((lastPortfolio - 100) * 100) / 100
  const benchmarkReturn = Math.round((lastBenchmark - 100) * 100) / 100
  const alpha = Math.round((portfolioReturn - benchmarkReturn) * 100) / 100

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-blue-500 rounded" />
            <span className="text-muted-foreground">Portefeuille</span>
            <span className={cn("font-semibold tabular-nums", portfolioReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
              {portfolioReturn >= 0 ? "+" : ""}{portfolioReturn.toFixed(1)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-gray-400 rounded" />
            <span className="text-muted-foreground">{benchmarkName}</span>
            <span className={cn("font-semibold tabular-nums", benchmarkReturn >= 0 ? "text-foreground" : "text-red-500")}>
              {benchmarkReturn >= 0 ? "+" : ""}{benchmarkReturn.toFixed(1)}%
            </span>
          </span>
          <span className="text-muted-foreground">
            Alpha{" "}
            <span className={cn("font-semibold", alpha > 0 ? "text-emerald-600 dark:text-emerald-400" : alpha < 0 ? "text-red-500" : "text-foreground")}>
              {alpha > 0 ? "+" : ""}{alpha.toFixed(1)}%
            </span>
          </span>
        </div>
        <div className="flex rounded-md border text-xs overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 transition-colors",
                r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
