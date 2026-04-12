import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { Stock } from "@/types/stock"

interface StockSelectorProps {
  allStocks: Stock[]
  selected: string[]
  onChange: (tickers: string[]) => void
  max?: number
}

export function StockSelector({
  allStocks,
  selected,
  onChange,
  max = 5,
}: StockSelectorProps) {
  function toggle(ticker: string) {
    if (selected.includes(ticker)) {
      onChange(selected.filter((t) => t !== ticker))
    } else if (selected.length < max) {
      onChange([...selected, ticker])
    }
  }

  function remove(ticker: string) {
    onChange(selected.filter((t) => t !== ticker))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selected.map((ticker) => {
          const stock = allStocks.find((s) => s.ticker === ticker)
          return (
            <Badge
              key={ticker}
              variant="secondary"
              className="gap-1 py-1 pl-2.5 pr-1 text-sm"
            >
              <span className="font-mono">{ticker}</span>
              {stock && (
                <span className="ml-1 text-muted-foreground">
                  {stock.name.length > 20
                    ? stock.name.slice(0, 20) + "…"
                    : stock.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(ticker)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full max-w-sm justify-between font-normal"
          >
            {selected.length >= max
              ? `Maximum ${max} actions`
              : "Ajouter une action..."}
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher (ticker ou nom)..." />
            <CommandList>
              <CommandEmpty>Aucun résultat.</CommandEmpty>
              <CommandGroup>
                {allStocks.map((stock) => {
                  const isSelected = selected.includes(stock.ticker)
                  return (
                    <CommandItem
                      key={stock.ticker}
                      value={`${stock.ticker} ${stock.name}`}
                      onSelect={() => toggle(stock.ticker)}
                      disabled={!isSelected && selected.length >= max}
                    >
                      <div
                        className={cn(
                          "mr-2 flex size-4 items-center justify-center rounded-sm border",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                      <span className="mr-2 font-mono text-xs">{stock.ticker}</span>
                      <span className="truncate text-muted-foreground">
                        {stock.name}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
