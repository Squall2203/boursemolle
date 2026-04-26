import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export interface Challenge {
  id: number
  title: string
  description: string
  challenge_type: "weekly" | "monthly" | "annual"
  conditions: {
    metric: "weekly_trades" | "weekly_views" | "weekly_logins"
    target: number
    xp: number
  }
  badge_id: string | null
  starts_at: string
  ends_at: string
}

export interface UserChallenge {
  challenge_id: number
  status: "in_progress" | "completed" | "failed"
  completed_at: string | null
  progress: { current: number } | null
}

export interface ChallengeWithProgress {
  challenge: Challenge
  userRecord: UserChallenge | null
  current: number
  target: number
  completed: boolean
  daysLeft: number
}

export function useChallenges() {
  const { user } = useAuth()
  const [items, setItems] = useState<ChallengeWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }

    const now = new Date().toISOString()

    const [{ data: challenges }, { data: userRecords }] = await Promise.all([
      supabase
        .from("challenges")
        .select("*")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("ends_at", now),
      supabase
        .from("user_challenges")
        .select("*")
        .eq("user_id", user.id),
    ])

    if (!challenges || challenges.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    // Fetch portfolio IDs for trade queries
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id)
    const portfolioIds = portfolios?.map((p: { id: number }) => p.id) ?? []

    // Build progress for each challenge
    const enriched = await Promise.all(
      (challenges as Challenge[]).map(async (challenge) => {
        const userRecord =
          (userRecords as UserChallenge[] | null)?.find(
            (r) => r.challenge_id === challenge.id,
          ) ?? null

        const { metric, target, xp } = challenge.conditions
        const startsAt = challenge.starts_at
        let current = 0

        if (metric === "weekly_trades" && portfolioIds.length > 0) {
          const { count } = await supabase
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .in("portfolio_id", portfolioIds)
            .gte("executed_at", startsAt)
          current = count ?? 0
        } else if (metric === "weekly_views") {
          const { count } = await supabase
            .from("stock_views")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", startsAt)
          current = count ?? 0
        } else if (metric === "weekly_logins") {
          const { data: loginDays } = await supabase
            .from("xp_log")
            .select("created_at")
            .eq("user_id", user.id)
            .eq("action", "daily_login")
            .gte("created_at", startsAt)
          const distinctDays = new Set(
            (loginDays ?? []).map((r: { created_at: string }) =>
              r.created_at.slice(0, 10),
            ),
          )
          current = distinctDays.size
        }

        const completed = userRecord?.status === "completed" || current >= target

        // Auto-complete in DB if threshold reached and not yet recorded
        if (completed && userRecord?.status !== "completed") {
          const upsertData = {
            user_id: user.id,
            challenge_id: challenge.id,
            status: "completed" as const,
            completed_at: new Date().toISOString(),
            progress: { current: Math.min(current, target) },
          }
          await supabase.from("user_challenges").upsert(upsertData)

          // Award XP
          if (xp > 0) {
            await supabase.rpc("increment_user_xp", {
              p_user_id: user.id,
              p_amount: xp,
              p_action: `challenge_${challenge.id}`,
            })
          }
        } else if (!userRecord) {
          await supabase.from("user_challenges").upsert({
            user_id: user.id,
            challenge_id: challenge.id,
            status: "in_progress",
            progress: { current },
          })
        }

        const endsAt = new Date(challenge.ends_at)
        const daysLeft = Math.max(
          0,
          Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )

        return {
          challenge: { ...challenge, conditions: { ...challenge.conditions, xp } },
          userRecord,
          current: Math.min(current, target),
          target,
          completed,
          daysLeft,
        }
      }),
    )

    setItems(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return { items, loading, refetch: load }
}
