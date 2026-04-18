import { useState } from "react"
import { Globe } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"

type Tab = "login" | "signup"

export function AuthModal() {
  const { authModalOpen, closeAuthModal, signInWithEmail, signUpWithEmail, signInWithGoogle } =
    useAuth()
  const [tab, setTab] = useState<Tab>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setEmail("")
    setPassword("")
    setError(null)
    setInfo(null)
  }

  function switchTab(t: Tab) {
    setTab(t)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (tab === "login") {
      const { error } = await signInWithEmail(email, password)
      if (error) {
        setError(error)
      } else {
        closeAuthModal()
        resetForm()
      }
    } else {
      const { error } = await signUpWithEmail(email, password)
      if (error) {
        setError(error)
      } else {
        setInfo("Vérifiez votre email pour confirmer votre inscription.")
      }
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await signInWithGoogle()
  }

  return (
    <Dialog
      open={authModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeAuthModal()
          resetForm()
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {tab === "login" ? "Connexion" : "Créer un compte"}
          </DialogTitle>
          <DialogDescription>
            {tab === "login"
              ? "Accédez à votre Paper PEA et vos badges."
              : "Gratuit — investissez virtuellement sans risque."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => switchTab("login")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              tab === "login"
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => switchTab("signup")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              tab === "signup"
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Google */}
        <Button variant="outline" className="w-full gap-2" onClick={handleGoogle} type="button">
          <Globe className="size-4" />
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Mot de passe</Label>
            <Input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-green-600 dark:text-green-400">{info}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Chargement..."
              : tab === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {tab === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => switchTab("signup")}
                className="text-primary hover:underline"
              >
                S'inscrire
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={() => switchTab("login")}
                className="text-primary hover:underline"
              >
                Se connecter
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  )
}
