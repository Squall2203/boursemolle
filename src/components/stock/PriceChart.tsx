import { useEffect, useMemo, useRef, useState } from "react"
import {
  createChart,
  type IChartApi,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts"
import { Button } from "@/components/ui/button"
import type { PriceCandle } from "@/types/stock"

type Period = "1M" | "3M" | "6M" | "1A" | "3A" | "5A" | "Max"

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1A", label: "1A", days: 365 },
  { key: "3A", label: "3A", days: 365 * 3 },
  { key: "5A", label: "5A", days: 365 * 5 },
  { key: "Max", label: "Max", days: Infinity },
]

function filterByPeriod(candles: PriceCandle[], days: number): PriceCandle[] {
  if (days === Infinity || candles.length === 0) return candles
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  return candles.filter((c) => c.date >= cutoffStr)
}

function aggregateWeekly(candles: PriceCandle[]): PriceCandle[] {
  if (candles.length === 0) return []
  const weeks: PriceCandle[] = []
  let current: PriceCandle | null = null

  for (const c of candles) {
    const d = new Date(c.date)
    const monday = new Date(d)
    monday.setDate(d.getDate() - d.getDay() + 1)
    const weekKey = monday.toISOString().split("T")[0]

    if (!current || current.date !== weekKey) {
      if (current) weeks.push(current)
      current = { ...c, date: weekKey }
    } else {
      current.high = Math.max(current.high, c.high)
      current.low = Math.min(current.low, c.low)
      current.close = c.close
      current.volume += c.volume
    }
  }
  if (current) weeks.push(current)
  return weeks
}

interface PriceChartProps {
  candles: PriceCandle[]
  currency: string
}

export function PriceChart({ candles, currency }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [period, setPeriod] = useState<Period>("1A")

  const maxDays = useMemo(() => {
    if (candles.length < 2) return 0
    const first = new Date(candles[0].date)
    const last = new Date(candles[candles.length - 1].date)
    return Math.round((last.getTime() - first.getTime()) / 86400000)
  }, [candles])

  const displayCandles = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!
    const filtered = filterByPeriod(candles, p.days)
    if (p.days > 365 * 2) return aggregateWeekly(filtered)
    return filtered
  }, [candles, period])

  useEffect(() => {
    const container = containerRef.current
    if (!container || displayCandles.length === 0) return

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
        priceFormatter: (price: number) =>
          `${price.toFixed(2)} ${currency === "EUR" ? "€" : currency}`,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    })

    candleSeries.setData(
      displayCandles.map((c) => ({
        time: c.date,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    volumeSeries.setData(
      displayCandles.map((c) => ({
        time: c.date,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
      })),
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
  }, [displayCandles, currency])

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {PERIODS.map((p) => {
          const disabled = p.days !== Infinity && maxDays < p.days * 0.8
          return (
            <Button
              key={p.key}
              variant={period === p.key ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={disabled}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          )
        })}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
