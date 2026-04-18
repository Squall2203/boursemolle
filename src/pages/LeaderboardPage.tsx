import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

export function LeaderboardPage() {
  const { user, openAuthModal } = useAuth()

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Trophy className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Classement mensuel</h1>
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
      <h1 className="text-2xl font-bold">Classement mensuel</h1>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Le leaderboard arrive en Sprint 4.
      </div>
    </div>
  )
}
