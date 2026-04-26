import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Stock } from "@/types/stock"

const MAX_RESULTS = 12

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function matches(stock: Stock, query: string): boolean {
  const q = normalize(query)
  return normalize(stock.ticker).includes(q) || normalize(stock.name).includes(q)
}

export function SearchCommand() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/data/stocks.json")
      .then((r) => r.json())
      .then((data) => setStocks(data.stocks ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    return stocks.filter((s) => matches(s, query)).slice(0, MAX_RESULTS)
  }, [query, stocks])

  const select = useCallback(
    (ticker: string) => {
      setOpen(false)
      setQuery("")
      navigate(`/stock/${ticker}`)
    },
    [navigate],
  )

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "Escape") {
        inputRef.current?.blur()
        setOpen(false)
      }
      return
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % results.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + results.length) % results.length)
        break
      case "Enter":
        e.preventDefault()
        if (results[activeIndex]) select(results[activeIndex].ticker)
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  const formatPrice = (n: number | null) => (n != null ? n.toFixed(2) : "—")

  const formatChange = (n: number | null) => {
    if (n == null) return null
    const sign = n >= 0 ? "+" : ""
    return `${sign}${n.toFixed(2)}%`
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-8 w-48 items-center gap-2 rounded-md border bg-background px-2.5 text-xs sm:w-64">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          Ctrl+K
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 z-50 mt-1 w-[400px] max-h-[380px] overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {results.map((s, i) => {
            const change = formatChange(s.priceChangePercent)
            return (
              <button
                key={s.ticker}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  i === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50",
                )}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus on input
                  select(s.ticker)
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold shrink-0">
                    {s.ticker}
                  </span>
                  <span className="truncate">{s.name}</span>
                  {s.peaEligible && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                      PEA
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="font-mono">{formatPrice(s.price, s.currency)}</span>
                  {change && (
                    <span
                      className={cn(
                        "font-mono",
                        s.priceChangePercent != null && s.priceChangePercent >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {change}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[400px] rounded-lg border bg-popover p-4 shadow-lg text-center text-sm text-muted-foreground">
          Aucun résultat pour « {query} »
        </div>
      )}
    </div>
  )
}
