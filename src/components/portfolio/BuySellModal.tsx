import { useState } from "react"
import { Link } from "react-router-dom"
import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { formatPrice, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export function BuySellModal() {
  const {
    tradeModalStock: stock,
    tradeModalType,
    closeTradeModal,
    activePortfolio,
    positions,
    executeBuy,
    executeSell,
  } = usePortfolio()

  const [tab, setTab] = useState<"buy" | "sell">(tradeModalType)
  const [amount, setAmount] = useState("")
  const [sellQty, setSellQty] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const open = stock !== null

  if (!stock) return null

  const rawPrice = stock.price ?? 0
  // GBp stocks are quoted in pence — convert to £ for paper trade amounts
  const price = stock.currency === "GBp" ? rawPrice / 100 : rawPrice
  const tradeDisplayCurrency = stock.currency === "GBp" ? "GBP" : stock.currency
  const position = positions.find((p) => p.ticker === stock.ticker)

  const amountNum = parseFloat(amount.replace(",", ".")) || 0
  const buyQty = price > 0 ? Math.floor(amountNum / price) : 0
  const buyTotal = buyQty * price

  const sellQtyNum = parseInt(sellQty) || 0
  const maxQty = position?.quantity ?? 0
  const pl = position ? (price - position.avg_price) * position.quantity : 0
  const plPct = position?.avg_price
    ? ((price - position.avg_price) / position.avg_price) * 100
    : 0

  async function handleBuy() {
    if (!activePortfolio || buyQty <= 0) return
    setSubmitting(true)
    setError(null)
    const { error } = await executeBuy(stock!.ticker, buyQty, price)
    setSubmitting(false)
    if (error) setError(error)
    else closeTradeModal()
  }

  async function handleSell() {
    if (!activePortfolio || sellQtyNum <= 0) return
    setSubmitting(true)
    setError(null)
    const { error } = await executeSell(stock!.ticker, sellQtyNum, price)
    setSubmitting(false)
    if (error) setError(error)
    else closeTradeModal()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeTradeModal()}>
      <DialogContent key={`${stock?.ticker ?? ""}-${tradeModalType}`} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <span className="font-bold">{stock.ticker}</span>
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {stock.name}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!activePortfolio ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Créez d'abord un Paper PEA pour investir.
            </p>
            <Button asChild>
              <Link to="/portfolio" onClick={closeTradeModal}>
                Créer mon Paper PEA
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {!stock.peaEligible && (
              <div className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong>Hors PEA</strong> — dans la réalité, cette action ne peut pas être détenue dans un PEA. Ce simulateur l'autorise à titre pédagogique.
                  {stock.currency !== "EUR" && " Prix converti en EUR simulé."}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Prix de clôture</span>
              <span className="font-semibold">{formatPrice(rawPrice, stock.currency)}</span>
            </div>

            {position && (
              <div className="flex rounded-lg bg-muted p-1 text-sm">
                {(["buy", "sell"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTab(t); setError(null) }}
                    className={cn(
                      "flex-1 rounded-md py-1.5 transition-colors",
                      tab === t
                        ? "bg-background font-medium text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "buy" ? "Acheter" : "Vendre"}
                  </button>
                ))}
              </div>
            )}

            {tab === "buy" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="trade-amount">Montant à investir</Label>
                  <div className="relative">
                    <Input
                      id="trade-amount"
                      type="number"
                      placeholder="1 000"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-6"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      €
                    </span>
                  </div>
                  {buyQty > 0 && (
                    <p className="text-xs text-muted-foreground">
                      → {buyQty} action{buyQty > 1 ? "s" : ""} · total {formatPrice(buyTotal, tradeDisplayCurrency)}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Solde disponible</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(activePortfolio.cash_balance)}
                  </span>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button
                  className="w-full"
                  onClick={handleBuy}
                  disabled={submitting || buyQty <= 0 || buyTotal > activePortfolio.cash_balance}
                >
                  {submitting
                    ? "Exécution..."
                    : buyQty > 0
                      ? `Acheter ${buyQty} action${buyQty > 1 ? "s" : ""} — ${formatPrice(buyTotal, tradeDisplayCurrency)}`
                      : "Entrez un montant"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position</span>
                    <span className="font-medium">{maxQty} actions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PRU</span>
                    <span>{formatPrice(position!.avg_price, tradeDisplayCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">P/L latent</span>
                    <span className={cn("font-medium", pl >= 0 ? "text-emerald-600" : "text-red-500")}>
                      {pl >= 0 ? "+" : ""}
                      {formatPrice(pl, tradeDisplayCurrency)} ({formatPercent(plPct, true)})
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="sell-qty">Quantité</Label>
                    <Input
                      id="sell-qty"
                      type="number"
                      placeholder="0"
                      min="1"
                      max={maxQty}
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSellQty(String(maxQty))}
                    >
                      Tout
                    </Button>
                  </div>
                </div>

                {sellQtyNum > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Montant estimé : {formatPrice(sellQtyNum * price, tradeDisplayCurrency)}
                  </p>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleSell}
                  disabled={submitting || sellQtyNum <= 0 || sellQtyNum > maxQty}
                >
                  {submitting
                    ? "Exécution..."
                    : sellQtyNum > 0
                      ? `Vendre ${sellQtyNum} action${sellQtyNum > 1 ? "s" : ""} — ${formatPrice(sellQtyNum * price, tradeDisplayCurrency)}`
                      : "Entrez une quantité"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
