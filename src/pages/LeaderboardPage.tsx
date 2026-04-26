import { Trophy, Medal, Crown, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useLeaderboard } from "@/hooks/useLeaderboard"
import { formatPrice, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="size-4 text-amber-400" />
  if (rank === 2) return <Medal className="size-4 text-slate-400" />
  if (rank === 3) return <Medal className="size-4 text-amber-600" />
  return <span className="w-4 text-center text-xs font-bold text-muted-foreground">{rank}</span>
}

function UserAvatar({ pseudo, avatarUrl }: { pseudo: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={pseudo}
        className="size-8 rounded-full object-cover ring-1 ring-border"
      />
    )
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {pseudo.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function LeaderboardPage() {
  const { user, openAuthModal } = useAuth()
  const { entries, loading, error } = useLeaderboard()

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Trophy className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="max-w-sm text-muted-foreground">
          Connectez-vous pour rejoindre le classement et comparer votre Paper PEA
          avec les autres investisseurs.
        </p>
        <Button onClick={openAuthModal}>Se connecter</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Portfolios publics classés par valeur totale. Rendez votre portfolio public depuis l'onglet Portfolio.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Top portfolios
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chargement...</div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-500">Erreur : {error}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Trophy className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Aucun portfolio public pour l'instant</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Soyez le premier ! Rendez votre portfolio public depuis la page Portfolio.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((entry, idx) => {
                const rank = idx + 1
                const isCurrentUser = entry.user_id === user.id
                const isPositive = entry.performance >= 0

                return (
                  <div
                    key={entry.portfolio_id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors",
                      isCurrentUser && "bg-primary/5",
                    )}
                  >
                    <div className="flex w-6 shrink-0 items-center justify-center">
                      <RankIcon rank={rank} />
                    </div>

                    <UserAvatar pseudo={entry.pseudo} avatarUrl={entry.avatar_url} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{entry.pseudo}</span>
                        {isCurrentUser && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Vous
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{entry.portfolio_name}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold">{formatPrice(entry.total_value)}</div>
                      <div className={cn("text-xs font-medium", isPositive ? "text-emerald-600" : "text-red-500")}>
                        {formatPercent(entry.performance, true)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Classement basé sur le dernier snapshot de valeur de portefeuille.
        </p>
      )}
    </div>
  )
}
