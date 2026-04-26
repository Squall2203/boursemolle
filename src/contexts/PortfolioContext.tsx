import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useXP } from "@/contexts/XPContext"
import { XP_ACTIONS } from "@/lib/xp"
import type { Stock } from "@/types/stock"

export interface DbPortfolio {
  id: number
  user_id: string
  name: string
  initial_capital: number
  cash_balance: number
  is_active: boolean
  is_public: boolean
  created_at: string
  reset_at: string | null
}

export interface DbPosition {
  id: number
  portfolio_id: number
  ticker: string
  quantity: number
  avg_price: number
  opened_at: string
}

export interface DbTransaction {
  id: number
  portfolio_id: number
  ticker: string
  type: "buy" | "sell"
  quantity: number
  price: number
  total: number
  executed_at: string
}

interface PortfolioContextValue {
  portfolios: DbPortfolio[]
  activePortfolio: DbPortfolio | null
  activePortfolioId: number | null
  setActivePortfolioId: (id: number) => void
  positions: DbPosition[]
  transactions: DbTransaction[]
  loading: boolean
  createPortfolio: (name: string) => Promise<DbPortfolio | null>
  executeBuy: (ticker: string, quantity: number, price: number) => Promise<{ error: string | null }>
  executeSell: (ticker: string, quantity: number, price: number) => Promise<{ error: string | null }>
  refetch: () => Promise<void>
  saveSnapshot: (totalValue: number, cashBalance: number, positionsValue: number) => Promise<void>
  togglePublic: () => Promise<void>
  resetPortfolio: () => Promise<{ error: string | null }>
  tradeModalStock: Stock | null
  tradeModalType: "buy" | "sell"
  openTradeModal: (stock: Stock, type?: "buy" | "sell") => void
  closeTradeModal: () => void
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { awardXP, grantBadge, incrementTradeCount } = useXP()
  const [portfolios, setPortfolios] = useState<DbPortfolio[]>([])
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null)
  const [positions, setPositions] = useState<DbPosition[]>([])
  const [transactions, setTransactions] = useState<DbTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [tradeModalStock, setTradeModalStock] = useState<Stock | null>(null)
  const [tradeModalType, setTradeModalType] = useState<"buy" | "sell">("buy")

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null

  const loadPortfolioData = useCallback(async (portfolioId: number) => {
    const [{ data: pos }, { data: tx }] = await Promise.all([
      supabase.from("positions").select("*").eq("portfolio_id", portfolioId),
      supabase
        .from("transactions")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("executed_at", { ascending: false })
        .limit(100),
    ])
    setPositions(pos ?? [])
    setTransactions(tx ?? [])
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)
    const { data: pList } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    const portfoliosList: DbPortfolio[] = pList ?? []
    setPortfolios(portfoliosList)

    const firstId = portfoliosList[0]?.id ?? null
    setActivePortfolioId(firstId)

    if (firstId) {
      await loadPortfolioData(firstId)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPortfolios([])
      setPositions([])
      setTransactions([])
      setActivePortfolioId(null)
      return
    }
    loadAll(user.id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activePortfolioId) loadPortfolioData(activePortfolioId)
  }, [activePortfolioId, loadPortfolioData])

  async function refetch() {
    if (!user) return
    const { data: pList } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
    const portfoliosList: DbPortfolio[] = pList ?? []
    setPortfolios(portfoliosList)

    const targetId = activePortfolioId ?? portfoliosList[0]?.id ?? null
    if (targetId) {
      await loadPortfolioData(targetId)
      if (!activePortfolioId) setActivePortfolioId(targetId)
    }
  }

  async function saveSnapshot(
    totalValue: number,
    cashBalance: number,
    positionsValue: number,
  ) {
    if (!activePortfolioId) return
    await supabase.rpc("upsert_portfolio_snapshot", {
      p_portfolio_id: activePortfolioId,
      p_total_value: totalValue,
      p_cash_balance: cashBalance,
      p_positions_value: positionsValue,
    })
  }

  async function togglePublic() {
    if (!activePortfolio) return
    const newValue = !activePortfolio.is_public
    await supabase
      .from("portfolios")
      .update({ is_public: newValue })
      .eq("id", activePortfolio.id)
    setPortfolios((prev) =>
      prev.map((p) => (p.id === activePortfolio.id ? { ...p, is_public: newValue } : p)),
    )
  }

  async function resetPortfolio(): Promise<{ error: string | null }> {
    if (!activePortfolioId) return { error: "Aucun portefeuille actif" }
    const { error } = await supabase.rpc("reset_portfolio", { p_portfolio_id: activePortfolioId })
    if (error) return { error: error.message }
    await refetch()
    return { error: null }
  }

  async function createPortfolio(name: string): Promise<DbPortfolio | null> {
    if (!user) return null
    const count = portfolios.length
    if (count >= 3) return null
    const { data } = await supabase
      .from("portfolios")
      .insert({ user_id: user.id, name })
      .select()
      .single()
    if (data) {
      setPortfolios((prev) => [...prev, data])
      setActivePortfolioId(data.id)
      const a = XP_ACTIONS.CREATE_PORTFOLIO
      await awardXP(a.action, a.xp, a.dailyMax, "Premier Paper PEA créé")
    }
    return data ?? null
  }

  async function executeBuy(
    ticker: string,
    quantity: number,
    price: number,
  ): Promise<{ error: string | null }> {
    if (!activePortfolio) return { error: "Aucun portefeuille actif" }
    const total = Math.round(quantity * price * 100) / 100
    if (activePortfolio.cash_balance < total) return { error: "Solde insuffisant" }

    const existingPos = positions.find((p) => p.ticker === ticker)

    // Step 1: Insert transaction record
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({ portfolio_id: activePortfolio.id, ticker, type: "buy", quantity, price, total })
      .select()
      .single()
    if (txErr) return { error: txErr.message }

    // Step 2: Update or create position
    let posError: string | null = null
    if (existingPos) {
      const newQty = existingPos.quantity + quantity
      const newAvg = (existingPos.avg_price * existingPos.quantity + price * quantity) / newQty
      const { error } = await supabase
        .from("positions")
        .update({ quantity: newQty, avg_price: newAvg })
        .eq("id", existingPos.id)
      if (error) posError = error.message
    } else {
      const { error } = await supabase
        .from("positions")
        .insert({ portfolio_id: activePortfolio.id, ticker, quantity, avg_price: price })
      if (error) posError = error.message
    }

    if (posError) {
      // Rollback: delete the transaction record
      await supabase.from("transactions").delete().eq("id", tx.id)
      await refetch()
      return { error: posError }
    }

    // Step 3: Deduct cash balance
    const { error: cashErr } = await supabase
      .from("portfolios")
      .update({ cash_balance: activePortfolio.cash_balance - total })
      .eq("id", activePortfolio.id)

    if (cashErr) {
      // Rollback: undo position and transaction
      if (existingPos) {
        await supabase
          .from("positions")
          .update({ quantity: existingPos.quantity, avg_price: existingPos.avg_price })
          .eq("id", existingPos.id)
      } else {
        await supabase
          .from("positions")
          .delete()
          .eq("ticker", ticker)
          .eq("portfolio_id", activePortfolio.id)
      }
      await supabase.from("transactions").delete().eq("id", tx.id)
      await refetch()
      return { error: cashErr.message }
    }

    await refetch()

    // XP + badge
    const a = XP_ACTIONS.TRADE
    await awardXP(a.action, a.xp, a.dailyMax, "Ordre exécuté")
    await grantBadge("first_trade", "🎬", "Premier trade")
    incrementTradeCount()

    return { error: null }
  }

  async function executeSell(
    ticker: string,
    quantity: number,
    price: number,
  ): Promise<{ error: string | null }> {
    if (!activePortfolio) return { error: "Aucun portefeuille actif" }
    const position = positions.find((p) => p.ticker === ticker)
    if (!position || position.quantity < quantity) return { error: "Position insuffisante" }

    const total = Math.round(quantity * price * 100) / 100

    // Step 1: Insert transaction record
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({ portfolio_id: activePortfolio.id, ticker, type: "sell", quantity, price, total })
      .select()
      .single()
    if (txErr) return { error: txErr.message }

    // Step 2: Update or delete position
    let posError: string | null = null
    if (position.quantity === quantity) {
      const { error } = await supabase.from("positions").delete().eq("id", position.id)
      if (error) posError = error.message
    } else {
      const { error } = await supabase
        .from("positions")
        .update({ quantity: position.quantity - quantity })
        .eq("id", position.id)
      if (error) posError = error.message
    }

    if (posError) {
      await supabase.from("transactions").delete().eq("id", tx.id)
      await refetch()
      return { error: posError }
    }

    // Step 3: Credit cash balance
    const { error: cashErr } = await supabase
      .from("portfolios")
      .update({ cash_balance: activePortfolio.cash_balance + total })
      .eq("id", activePortfolio.id)

    if (cashErr) {
      // Rollback: undo position and transaction
      if (position.quantity === quantity) {
        await supabase.from("positions").insert({
          id: position.id,
          portfolio_id: position.portfolio_id,
          ticker: position.ticker,
          quantity: position.quantity,
          avg_price: position.avg_price,
        })
      } else {
        await supabase
          .from("positions")
          .update({ quantity: position.quantity })
          .eq("id", position.id)
      }
      await supabase.from("transactions").delete().eq("id", tx.id)
      await refetch()
      return { error: cashErr.message }
    }

    await refetch()

    // XP + badges
    const a = XP_ACTIONS.TRADE
    await awardXP(a.action, a.xp, a.dailyMax, "Ordre exécuté")
    await grantBadge("first_trade", "🎬", "Premier trade")
    incrementTradeCount()

    const sellPLPercent = ((price - position.avg_price) / position.avg_price) * 100
    if (sellPLPercent < -20) {
      await grantBadge("paper_hands", "🧻", "Mains de papier")
    }

    return { error: null }
  }

  return (
    <PortfolioContext.Provider
      value={{
        portfolios,
        activePortfolio,
        activePortfolioId,
        setActivePortfolioId,
        positions,
        transactions,
        loading,
        createPortfolio,
        executeBuy,
        executeSell,
        refetch,
        saveSnapshot,
        togglePublic,
        resetPortfolio,
        tradeModalStock,
        tradeModalType,
        openTradeModal: (stock, type = "buy") => {
          setTradeModalStock(stock)
          setTradeModalType(type)
        },
        closeTradeModal: () => setTradeModalStock(null),
      }}
    >
      {children}
    </PortfolioContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error("usePortfolio doit être utilisé dans PortfolioProvider")
  return ctx
}
