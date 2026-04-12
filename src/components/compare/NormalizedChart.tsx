import { useEffect, useRef } from "react"
import {
  createChart,
  type IChartApi,
  ColorType,
  CrosshairMode,
  LineSeries,
} from "lightweight-charts"
import type { StockPriceHistory } from "@/types/stock"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

interface NormalizedChartProps {
  histories: Array<{ ticker: string; data: StockPriceHistory }>
}

export function NormalizedChart({ histories }: NormalizedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || histories.length === 0) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'Geist Variable', system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(156, 163, 175, 0.08)" },
        horzLines: { color: "rgba(156, 163, 175, 0.08)" },
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
        priceFormatter: (price: number) => `${price.toFixed(1)}`,
      },
    })

    histories.forEach(({ data }, i) => {
      if (data.candles.length === 0) return
      const basePrice = data.candles[0].close

      const series = chart.addSeries(LineSeries, {
        color: COLORS[i % COLORS.length],
        lineWidth: 2,
        priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}` },
      })

      series.setData(
        data.candles.map((c) => ({
          time: c.date,
          value: (c.close / basePrice) * 100,
        })),
      )
    })

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
  }, [histories])

  return (
    <div>
      <div ref={containerRef} className="w-full" />
      <div className="mt-3 flex flex-wrap gap-4">
        {histories.map(({ ticker }, i) => (
          <div key={ticker} className="flex items-center gap-2 text-sm">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="font-mono">{ticker}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
