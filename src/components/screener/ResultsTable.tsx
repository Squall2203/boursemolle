import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

type SortKey =
  | "ticker"
  | "name"
  | "sector"
  | "country"
  | "marketCap"
  | "price"
  | "priceChangePercent"
  | "trailingPE"
  | "returnOnEquity"
  | "dividendYield"
  | "score"

type SortDir = "asc" | "desc"

interface ColumnDef {
  key: SortKey
  label: string
  align: "left" | "right"
  className?: string
}

const COLUMNS: ColumnDef[] = [
  { key: "score", label: "Score", align: "right" },
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "name", label: "Nom", align: "left" },
  { key: "sector", label: "Secteur", align: "left" },
  { key: "country", label: "Pays", align: "left" },
  { key: "marketCap", label: "Capi", align: "right" },
  { key: "price", label: "Prix", align: "right" },
  { key: "priceChangePercent", label: "Var. j.", align: "right" },
  { key: "trailingPE", label: "P/E", align: "right" },
  { key: "returnOnEquity", label: "ROE", align: "right" },
  { key: "dividendYield", label: "Div.", align: "right" },
]

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
const LS_KEY = "boursemolle-pagesize"

function getStoredPageSize(): number {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v != null) return Number(v)
  } catch {}
  return 50
}

export function ResultsTable({ stocks, allStocks }: ResultsTableProps) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>("marketCap")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState(getStoredPageSize)
  const [page, setPage] = useState(0)

  const scoreMap = useMemo(() => {
    const map = new Map<string, StockScore>()
    for (const s of stocks) {
      map.set(s.ticker, computeScore(s, allStocks))
    }
    return map
  }, [stocks, allStocks])

  const sorted = useMemo(() => {
    const copy = [...stocks]
    copy.sort((a, b) => {
      if (sortKey === "score") {
        const sa = scoreMap.get(a.ticker)?.total ?? 0
        const sb = scoreMap.get(b.ticker)?.total ?? 0
        return sortDir === "asc" ? sa - sb : sb - sa
      }
      return compareValues(
        a[sortKey] as number | string | null,
        b[sortKey] as number | string | null,
        sortDir,
      )
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
      setSortDir(key === "ticker" || key === "name" || key === "sector" || key === "country" ? "asc" : "desc")
    }
    setPage(0)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => {
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
                  colSpan={COLUMNS.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  Aucune action ne correspond aux filtres.
                </TableCell>
              </TableRow>
            ) : (
              pageStocks.map((s) => {
                const score = scoreMap.get(s.ticker)
                const change = s.priceChangePercent
                const changeClass =
                  change == null
                    ? "text-muted-foreground"
                    : change > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : change < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                return (
                  <TableRow
                    key={s.ticker}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/stock/${s.ticker}`)}
                  >
                    <TableCell className="text-right">
                      {score && (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {score.total.toFixed(1)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("h-5 px-1.5 text-[10px] font-semibold", score.labelColor)}
                          >
                            {score.label}
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      <div className="flex items-center gap-2">
                        {s.ticker}
                        {s.peaEligible && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[9px] uppercase"
                          >
                            PEA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate" title={s.name}>
                      {s.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.sector ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.country}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMarketCap(s.marketCap)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(s.price, s.currency)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", changeClass)}>
                      {formatPercent(change, true)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRatio(s.trailingPE)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(s.returnOnEquity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(s.dividendYield)}
                    </TableCell>
                  </TableRow>
                )
              })
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
