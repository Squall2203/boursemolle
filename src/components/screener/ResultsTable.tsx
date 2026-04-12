import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
} from "@/lib/format"
import { computeScore, type StockScore } from "@/lib/scoring"
import type { Stock } from "@/types/stock"

type SortKey = string

type SortDir = "asc" | "desc"

interface ColumnDef {
  key: string
  label: string
  align: "left" | "right"
  group: string
  getValue: (s: Stock) => number | string | null
  format: (s: Stock, scoreMap: Map<string, StockScore>) => React.ReactNode
}

const TEXT_SORT_KEYS = new Set(["ticker", "name", "sector", "country", "industry"])

const ALL_COLUMNS: ColumnDef[] = [
  {
    key: "score", label: "Score", align: "right", group: "Général",
    getValue: () => null,
    format: (s, scoreMap) => {
      const score = scoreMap.get(s.ticker)
      if (!score) return null
      return (
        <div className="flex items-center justify-end gap-1.5">
          <span className="font-mono text-xs font-semibold tabular-nums">{score.total.toFixed(1)}</span>
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-semibold", score.labelColor)}>{score.label}</Badge>
        </div>
      )
    },
  },
  {
    key: "ticker", label: "Ticker", align: "left", group: "Général",
    getValue: (s) => s.ticker,
    format: (s) => (
      <div className="flex items-center gap-2 font-mono text-xs font-medium">
        {s.ticker}
        {s.peaEligible && <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase">PEA</Badge>}
      </div>
    ),
  },
  {
    key: "name", label: "Nom", align: "left", group: "Général",
    getValue: (s) => s.name,
    format: (s) => <span className="max-w-[260px] truncate" title={s.name}>{s.name}</span>,
  },
  {
    key: "sector", label: "Secteur", align: "left", group: "Général",
    getValue: (s) => s.sector,
    format: (s) => <span className="text-muted-foreground">{s.sector ?? "—"}</span>,
  },
  {
    key: "industry", label: "Industrie", align: "left", group: "Général",
    getValue: (s) => s.industry,
    format: (s) => <span className="text-muted-foreground">{s.industry ?? "—"}</span>,
  },
  {
    key: "country", label: "Pays", align: "left", group: "Général",
    getValue: (s) => s.country,
    format: (s) => <span className="text-muted-foreground">{s.country}</span>,
  },
  {
    key: "marketCap", label: "Capi", align: "right", group: "Valorisation",
    getValue: (s) => s.marketCap,
    format: (s) => formatMarketCap(s.marketCap),
  },
  {
    key: "price", label: "Prix", align: "right", group: "Prix",
    getValue: (s) => s.price,
    format: (s) => formatPrice(s.price, s.currency),
  },
  {
    key: "priceChangePercent", label: "Var. j.", align: "right", group: "Prix",
    getValue: (s) => s.priceChangePercent,
    format: (s) => {
      const c = s.priceChangePercent
      const cls = c == null ? "text-muted-foreground" : c > 0 ? "text-emerald-600 dark:text-emerald-400" : c < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
      return <span className={cls}>{formatPercent(c, true)}</span>
    },
  },
  {
    key: "trailingPE", label: "P/E", align: "right", group: "Valorisation",
    getValue: (s) => s.trailingPE,
    format: (s) => formatRatio(s.trailingPE),
  },
  {
    key: "forwardPE", label: "P/E fwd", align: "right", group: "Valorisation",
    getValue: (s) => s.forwardPE,
    format: (s) => formatRatio(s.forwardPE),
  },
  {
    key: "priceToBook", label: "P/B", align: "right", group: "Valorisation",
    getValue: (s) => s.priceToBook,
    format: (s) => formatRatio(s.priceToBook),
  },
  {
    key: "evToEbitda", label: "EV/EBITDA", align: "right", group: "Valorisation",
    getValue: (s) => s.evToEbitda,
    format: (s) => formatRatio(s.evToEbitda),
  },
  {
    key: "returnOnEquity", label: "ROE", align: "right", group: "Profitabilité",
    getValue: (s) => s.returnOnEquity,
    format: (s) => formatPercent(s.returnOnEquity),
  },
  {
    key: "returnOnAssets", label: "ROA", align: "right", group: "Profitabilité",
    getValue: (s) => s.returnOnAssets,
    format: (s) => formatPercent(s.returnOnAssets),
  },
  {
    key: "profitMargins", label: "Marge nette", align: "right", group: "Profitabilité",
    getValue: (s) => s.profitMargins,
    format: (s) => formatPercent(s.profitMargins),
  },
  {
    key: "operatingMargins", label: "Marge op.", align: "right", group: "Profitabilité",
    getValue: (s) => s.operatingMargins,
    format: (s) => formatPercent(s.operatingMargins),
  },
  {
    key: "dividendYield", label: "Div.", align: "right", group: "Dividendes",
    getValue: (s) => s.dividendYield,
    format: (s) => formatPercent(s.dividendYield),
  },
  {
    key: "payoutRatio", label: "Payout", align: "right", group: "Dividendes",
    getValue: (s) => s.payoutRatio,
    format: (s) => formatPercent(s.payoutRatio),
  },
  {
    key: "revenueGrowth", label: "Croiss. CA", align: "right", group: "Croissance",
    getValue: (s) => s.revenueGrowth,
    format: (s) => formatPercent(s.revenueGrowth, true),
  },
  {
    key: "earningsGrowth", label: "Croiss. BPA", align: "right", group: "Croissance",
    getValue: (s) => s.earningsGrowth,
    format: (s) => formatPercent(s.earningsGrowth, true),
  },
  {
    key: "debtToEquity", label: "D/E", align: "right", group: "Bilan",
    getValue: (s) => s.debtToEquity,
    format: (s) => formatRatio(s.debtToEquity),
  },
  {
    key: "rsi14", label: "RSI", align: "right", group: "Technique",
    getValue: (s) => s.rsi14,
    format: (s) => formatRatio(s.rsi14),
  },
  {
    key: "perf1M", label: "Perf 1M", align: "right", group: "Technique",
    getValue: (s) => s.perf1M,
    format: (s) => formatPercent(s.perf1M, true),
  },
  {
    key: "perf3M", label: "Perf 3M", align: "right", group: "Technique",
    getValue: (s) => s.perf3M,
    format: (s) => formatPercent(s.perf3M, true),
  },
  {
    key: "perf6M", label: "Perf 6M", align: "right", group: "Technique",
    getValue: (s) => s.perf6M,
    format: (s) => formatPercent(s.perf6M, true),
  },
  {
    key: "perf1Y", label: "Perf 1A", align: "right", group: "Technique",
    getValue: (s) => s.perf1Y,
    format: (s) => formatPercent(s.perf1Y, true),
  },
]

const DEFAULT_VISIBLE = ["score", "ticker", "name", "sector", "country", "marketCap", "price", "priceChangePercent", "trailingPE", "returnOnEquity", "dividendYield"]
const LOCKED_COLUMNS = new Set(["ticker"])

const LS_COLS_KEY = "boursemolle-columns"
const LS_KEY = "boursemolle-pagesize"

function getStoredColumns(): string[] {
  try {
    const v = localStorage.getItem(LS_COLS_KEY)
    if (v) {
      const parsed = JSON.parse(v) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_VISIBLE
}

function compareValues(
  a: number | string | null,
  b: number | string | null,
  dir: SortDir,
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a
  }
  const sa = String(a)
  const sb = String(b)
  return dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa)
}

interface ResultsTableProps {
  stocks: Stock[]
  allStocks: Stock[]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 0]
const PAGE_SIZE_LABELS: Record<number, string> = { 0: "Tout" }

function getStoredPageSize(): number {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v != null) return Number(v)
  } catch {}
  return 50
}

function exportCsv(stocks: Stock[], columns: ColumnDef[], scoreMap: Map<string, StockScore>) {
  const header = columns.map((c) => c.label).join(";")
  const rows = stocks.map((s) => {
    return columns.map((c) => {
      if (c.key === "score") return scoreMap.get(s.ticker)?.total?.toFixed(1) ?? ""
      const v = c.getValue(s)
      if (v == null) return ""
      return String(v)
    }).join(";")
  })
  const csv = [header, ...rows].join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `boursemolle-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsTable({ stocks, allStocks }: ResultsTableProps) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>("marketCap")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState(getStoredPageSize)
  const [page, setPage] = useState(0)
  const [visibleKeys, setVisibleKeys] = useState<string[]>(getStoredColumns)

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleKeys.includes(c.key)),
    [visibleKeys],
  )

  function toggleColumn(key: string) {
    setVisibleKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      try { localStorage.setItem(LS_COLS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function resetColumns() {
    setVisibleKeys(DEFAULT_VISIBLE)
    try { localStorage.setItem(LS_COLS_KEY, JSON.stringify(DEFAULT_VISIBLE)) } catch {}
  }

  const scoreMap = useMemo(() => {
    const map = new Map<string, StockScore>()
    for (const s of stocks) {
      map.set(s.ticker, computeScore(s, allStocks))
    }
    return map
  }, [stocks, allStocks])

  const sorted = useMemo(() => {
    const col = ALL_COLUMNS.find((c) => c.key === sortKey)
    const copy = [...stocks]
    copy.sort((a, b) => {
      if (sortKey === "score") {
        const sa = scoreMap.get(a.ticker)?.total ?? 0
        const sb = scoreMap.get(b.ticker)?.total ?? 0
        return sortDir === "asc" ? sa - sb : sb - sa
      }
      if (!col) return 0
      return compareValues(col.getValue(a), col.getValue(b), sortDir)
    })
    return copy
  }, [stocks, sortKey, sortDir, scoreMap])

  const effectivePageSize = pageSize === 0 ? sorted.length : pageSize
  const totalPages = Math.max(1, Math.ceil(sorted.length / (effectivePageSize || 1)))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * effectivePageSize
  const pageStocks = sorted.slice(pageStart, pageStart + effectivePageSize)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(TEXT_SORT_KEYS.has(key) ? "asc" : "desc")
    }
    setPage(0)
  }

  const groups = useMemo(() => {
    const map = new Map<string, ColumnDef[]>()
    for (const col of ALL_COLUMNS) {
      const g = map.get(col.group) ?? []
      g.push(col)
      map.set(col.group, g)
    }
    return map
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Columns3 className="size-3.5" />
              Colonnes
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 max-h-96 overflow-y-auto p-3">
            <div className="space-y-3">
              {[...groups.entries()].map(([group, cols]) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                  <div className="space-y-1">
                    {cols.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={visibleKeys.includes(col.key)}
                          disabled={LOCKED_COLUMNS.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetColumns}>
                Réinitialiser
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => exportCsv(sorted, visibleColumns, scoreMap)}
        >
          <Download className="size-3.5" />
          CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => {
                const active = sortKey === col.key
                const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "select-none whitespace-nowrap",
                      col.align === "right" && "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
                        active ? "text-foreground" : "text-muted-foreground",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      <Icon className="size-3" />
                      {col.label}
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageStocks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  Aucune action ne correspond aux filtres.
                </TableCell>
              </TableRow>
            ) : (
              pageStocks.map((s) => (
                <TableRow
                  key={s.ticker}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/stock/${s.ticker}`)}
                >
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(col.align === "right" && "text-right tabular-nums")}
                    >
                      {col.format(s, scoreMap)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Lignes par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const n = Number(v)
              setPageSize(n)
              setPage(0)
              try { localStorage.setItem(LS_KEY, String(n)) } catch {}
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {PAGE_SIZE_LABELS[n] ?? n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span>
            {sorted.length === 0
              ? "0 résultat"
              : `Résultats ${pageStart + 1}–${Math.min(pageStart + effectivePageSize, sorted.length)} sur ${sorted.length}`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage((p) => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              disabled={safePage === 0}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              disabled={safePage >= totalPages - 1}
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
