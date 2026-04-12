import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Stock } from "@/types/stock"

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const [stocks, setStocks] = useState<Stock[]>([])
  const navigate = useNavigate()

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
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const select = useCallback(
    (ticker: string) => {
      setOpen(false)
      navigate(`/stock/${ticker}`)
    },
    [navigate],
  )

  const formatPrice = (n: number | null) =>
    n != null ? n.toFixed(2) : "—"

  const formatChange = (n: number | null) => {
    if (n == null) return null
    const sign = n >= 0 ? "+" : ""
    return `${sign}${n.toFixed(2)}%`
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-48 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-64"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">Rechercher...</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
          Ctrl+K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher une action (ex: LVMH, MC.PA, Air Liquide...)" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Actions">
            {stocks.map((s) => {
              const change = formatChange(s.priceChangePercent)
              return (
                <CommandItem
                  key={s.ticker}
                  value={`${s.ticker} ${s.name}`}
                  onSelect={() => select(s.ticker)}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold shrink-0">
                      {s.ticker}
                    </span>
                    <span className="truncate text-sm">{s.name}</span>
                    {s.peaEligible && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                        PEA
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="font-mono">{formatPrice(s.price)}</span>
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
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
