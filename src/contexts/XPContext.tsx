import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { XP_ACTIONS } from "@/lib/xp"

export interface XPNotification {
  id: string
  text: string
  emoji?: string
}

interface XPContextValue {
  currentXP: number
  earnedBadgeIds: Set<string>
  viewedTickerCount: number
  tradeCount: number
  notifications: XPNotification[]
  awardXP: (
    action: string,
    xp: number,
    dailyMax?: number,
    label?: string,
  ) => Promise<number>
  grantBadge: (badgeId: string, emoji: string, name: string) => Promise<boolean>
  trackStockView: (ticker: string) => Promise<void>
  refreshXP: () => Promise<void>
  incrementTradeCount: () => void
}

const XPContext = createContext<XPContextValue | null>(null)

export function XPProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentXP, setCurrentXP] = useState(0)
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set())
  const [viewedTickerCount, setViewedTickerCount] = useState(0)
  const [tradeCount, setTradeCount] = useState(0)
  const [notifications, setNotifications] = useState<XPNotification[]>([])
  const notifTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Prevent concurrent trackStockView calls for the same ticker
  const viewInFlight = useRef<Set<string>>(new Set())

  function pushNotification(text: string, emoji?: string) {
    const id = Math.random().toString(36).slice(2)
    setNotifications((prev) => [...prev, { id, text, emoji }])
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      notifTimers.current.delete(id)
    }, 3000)
    notifTimers.current.set(id, timer)
  }

  async function refreshXP() {
    if (!user) return
    const { data } = await supabase
      .from("users")
      .select("xp")
      .eq("id", user.id)
      .single()
    if (data) setCurrentXP(data.xp)
  }

  async function loadUserData(userId: string) {
    // Fetch portfolios first — needed to query transactions
    const { data: portfolioData } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)
    const portfolioIds = portfolioData?.map((p: { id: number }) => p.id) ?? []

    const [{ data: userData }, { data: badgeData }, { data: viewData }, { data: txData }] =
      await Promise.all([
        supabase.from("users").select("xp").eq("id", userId).single(),
        supabase.from("user_badges").select("badge_id").eq("user_id", userId),
        supabase.from("stock_views").select("ticker").eq("user_id", userId),
        portfolioIds.length > 0
          ? supabase
              .from("transactions")
              .select("id, portfolio_id")
              .in("portfolio_id", portfolioIds)
          : Promise.resolve({ data: [] as { id: number; portfolio_id: number }[] }),
      ])

    if (userData) setCurrentXP(userData.xp)
    if (badgeData) setEarnedBadgeIds(new Set(badgeData.map((b: { badge_id: string }) => b.badge_id)))
    if (viewData) {
      const uniqueTickers = new Set(viewData.map((v: { ticker: string }) => v.ticker))
      setViewedTickerCount(uniqueTickers.size)
    }
    if (txData) setTradeCount(txData.length)
  }

  useEffect(() => {
    if (!user) {
      setCurrentXP(0)
      setEarnedBadgeIds(new Set())
      setViewedTickerCount(0)
      setTradeCount(0)
      viewInFlight.current.clear()
      return
    }
    loadUserData(user.id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Daily login XP on first load
  useEffect(() => {
    if (!user) return
    const a = XP_ACTIONS.DAILY_LOGIN
    awardXP(a.action, a.xp, a.dailyMax, "Connexion du jour")
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const awardXP = useCallback(
    async (
      action: string,
      xp: number,
      dailyMax?: number,
      label?: string,
    ): Promise<number> => {
      if (!user) return 0

      if (dailyMax !== undefined) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count } = await supabase
          .from("xp_log")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("action", action)
          .gte("created_at", today.toISOString())
        if ((count ?? 0) >= dailyMax) return 0
      }

      const { data: newXP, error } = await supabase.rpc("increment_user_xp", {
        p_user_id: user.id,
        p_amount: xp,
        p_action: action,
      })
      if (error) return 0

      setCurrentXP(newXP as number)
      pushNotification(`+${xp} XP${label ? ` — ${label}` : ""}`, "⚡")
      return xp
    },
    [user],
  )

  const grantBadge = useCallback(
    async (badgeId: string, emoji: string, name: string): Promise<boolean> => {
      if (!user || earnedBadgeIds.has(badgeId)) return false

      const { error } = await supabase
        .from("user_badges")
        .insert({ user_id: user.id, badge_id: badgeId })
        .select()
        .single()

      if (error) return false

      setEarnedBadgeIds((prev) => new Set([...prev, badgeId]))
      pushNotification(`Badge débloqué : ${name}`, emoji)
      return true
    },
    [user, earnedBadgeIds],
  )

  const trackStockView = useCallback(
    async (ticker: string): Promise<void> => {
      if (!user) return
      // Prevent duplicate concurrent calls for the same ticker
      if (viewInFlight.current.has(ticker)) return
      viewInFlight.current.add(ticker)

      try {
        const { count } = await supabase
          .from("stock_views")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("ticker", ticker)

        await supabase.from("stock_views").insert({ user_id: user.id, ticker })

        if ((count ?? 0) === 0) {
          const newCount = viewedTickerCount + 1
          setViewedTickerCount(newCount)

          if (newCount >= 50 && !earnedBadgeIds.has("explorer")) {
            await grantBadge("explorer", "🗺️", "Explorateur")
          }
          if (newCount >= 200 && !earnedBadgeIds.has("encyclopedist")) {
            await grantBadge("encyclopedist", "📖", "Encyclopédiste")
          }
        }
      } finally {
        viewInFlight.current.delete(ticker)
      }
    },
    [user, viewedTickerCount, earnedBadgeIds, grantBadge],
  )

  function incrementTradeCount() {
    setTradeCount((c) => c + 1)
  }

  return (
    <XPContext.Provider
      value={{
        currentXP,
        earnedBadgeIds,
        viewedTickerCount,
        tradeCount,
        notifications,
        awardXP,
        grantBadge,
        trackStockView,
        refreshXP,
        incrementTradeCount,
      }}
    >
      {children}
    </XPContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useXP() {
  const ctx = useContext(XPContext)
  if (!ctx) throw new Error("useXP doit être utilisé dans XPProvider")
  return ctx
}
