import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMarketCap, formatPercent, formatRatio } from "@/lib/format"
import type { Stock } from "@/types/stock"

interface MetricRowProps {
  label: string
  value: string
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

interface FundamentalsTableProps {
  stock: Stock
}

export function FundamentalsTable({ stock }: FundamentalsTableProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Valorisation
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow label="P/E (TTM)" value={formatRatio(stock.trailingPE)} />
          <MetricRow label="P/E forward" value={formatRatio(stock.forwardPE)} />
          <MetricRow label="EV/EBITDA" value={formatRatio(stock.evToEbitda)} />
          <MetricRow label="P/B" value={formatRatio(stock.priceToBook)} />
          <MetricRow label="Valeur d'entreprise" value={formatMarketCap(stock.enterpriseValue, stock.currency)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Profitabilité
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow label="ROE" value={formatPercent(stock.returnOnEquity)} />
          <MetricRow label="ROA" value={formatPercent(stock.returnOnAssets)} />
          <MetricRow label="Marge nette" value={formatPercent(stock.profitMargins)} />
          <MetricRow label="Marge opérationnelle" value={formatPercent(stock.operatingMargins)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Croissance
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow label="Croissance CA (YoY)" value={formatPercent(stock.revenueGrowth)} />
          <MetricRow label="Croissance BPA (YoY)" value={formatPercent(stock.earningsGrowth)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Dividendes
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow label="Rendement" value={formatPercent(stock.dividendYield)} />
          <MetricRow label="Payout ratio" value={formatPercent(stock.payoutRatio)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bilan
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow label="Dette totale" value={formatMarketCap(stock.totalDebt, stock.currency)} />
          <MetricRow label="Trésorerie" value={formatMarketCap(stock.totalCash, stock.currency)} />
          <MetricRow label="Dette / Capitaux propres" value={formatRatio(stock.debtToEquity)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Extrêmes 52 semaines
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <MetricRow
            label="Plus haut"
            value={stock.fiftyTwoWeekHigh != null ? `${stock.fiftyTwoWeekHigh.toFixed(2)} €` : "—"}
          />
          <MetricRow
            label="Plus bas"
            value={stock.fiftyTwoWeekLow != null ? `${stock.fiftyTwoWeekLow.toFixed(2)} €` : "—"}
          />
          {stock.price != null && stock.fiftyTwoWeekHigh != null && (
            <MetricRow
              label="Écart au plus haut"
              value={formatPercent(
                ((stock.price - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100,
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
