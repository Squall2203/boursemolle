import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
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
  tradeModalStock: Stock | null
  tradeModalType: "buy" | "sell"
  openTradeModal: (stock: Stock, type?: "buy" | "sell") => void
  closeTradeModal: () => void
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { awardXP, grantBadge, tradeCount } = useXP()
  const [portfolios, setPortfolios] = useState<DbPortfolio[]>([])
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null)
  const [positions, setPositions] = useState<DbPosition[]>([])
  const [transactions, setTransactions] = useState<DbTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [tradeModalStock, setTradeModalStock] = useState<Stock | null>(null)
  const [tradeModalType, setTradeModalType] = useState<"buy" | "sell">("buy")

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null

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
      const [{ data: pos }, { data: tx }] = await Promise.all([
        supabase.from("positions").select("*").eq("portfolio_id", firstId),
        supabase
          .from("transactions")
          .select("*")
          .eq("portfolio_id", firstId)
          .order("executed_at", { ascending: false })
          .limit(100),
      ])
      setPositions(pos ?? [])
      setTransactions(tx ?? [])
    }

    setLoading(false)
  }

  async function loadPortfolioData(portfolioId: number) {
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
  }

  useEffect(() => {
    if (!user) {
      setPortfolios([])
      setPositions([])
      setTransactions([])
      setActivePortfolioId(null)
      return
    }
    loadAll(user.id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activePortfolioId) loadPortfolioData(activePortfolioId)
  }, [activePortfolioId]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const { error: txErr } = await supabase.from("transactions").insert({
      portfolio_id: activePortfolio.id,
      ticker,
      type: "buy",
      quantity,
      price,
      total,
    })
    if (txErr) return { error: txErr.message }

    if (existingPos) {
      const newQty = existingPos.quantity + quantity
      const newAvg = (existingPos.avg_price * existingPos.quantity + price * quantity) / newQty
      const { error } = await supabase
        .from("positions")
        .update({ quantity: newQty, avg_price: newAvg })
        .eq("id", existingPos.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from("positions").insert({
        portfolio_id: activePortfolio.id,
        ticker,
        quantity,
        avg_price: price,
      })
      if (error) return { error: error.message }
    }

    const { error: cashErr } = await supabase
      .from("portfolios")
      .update({ cash_balance: activePortfolio.cash_balance - total })
      .eq("id", activePortfolio.id)
    if (cashErr) return { error: cashErr.message }

    await refetch()

    // XP + badge premier trade
    const a = XP_ACTIONS.TRADE
    await awardXP(a.action, a.xp, a.dailyMax, "Ordre exécuté")
    if (tradeCount === 0) {
      await grantBadge("first_trade", "🎬", "Premier trade")
    }

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

    const { error: txErr } = await supabase.from("transactions").insert({
      portfolio_id: activePortfolio.id,
      ticker,
      type: "sell",
      quantity,
      price,
      total,
    })
    if (txErr) return { error: txErr.message }

    if (position.quantity === quantity) {
      const { error } = await supabase.from("positions").delete().eq("id", position.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase
        .from("positions")
        .update({ quantity: position.quantity - quantity })
        .eq("id", position.id)
      if (error) return { error: error.message }
    }

    const { error: cashErr } = await supabase
      .from("portfolios")
      .update({ cash_balance: activePortfolio.cash_balance + total })
      .eq("id", activePortfolio.id)
    if (cashErr) return { error: cashErr.message }

    await refetch()

    // XP + badge paper_hands si P/L < -20%
    const a = XP_ACTIONS.TRADE
    await awardXP(a.action, a.xp, a.dailyMax, "Ordre exécuté")
    if (tradeCount === 0) {
      await grantBadge("first_trade", "🎬", "Premier trade")
    }
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

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error("usePortfolio doit être utilisé dans PortfolioProvider")
  return ctx
}
