import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DbTransaction } from "@/contexts/PortfolioContext"

interface TransactionHistoryProps {
  transactions: DbTransaction[]
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Aucune transaction.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Date</th>
            <th className="px-4 py-2.5 text-left font-medium">Action</th>
            <th className="px-4 py-2.5 text-center font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Qté</th>
            <th className="px-4 py-2.5 text-right font-medium">Prix</th>
            <th className="px-4 py-2.5 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                {new Date(tx.executed_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}
              </td>
              <td className="px-4 py-2.5 font-medium">{tx.ticker}</td>
              <td className="px-4 py-2.5 text-center">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    tx.type === "buy"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-700 dark:text-red-400",
                  )}
                >
                  {tx.type === "buy" ? "Achat" : "Vente"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{tx.quantity}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatPrice(tx.price)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                {tx.type === "sell" ? "+" : ""}
                {formatPrice(tx.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
