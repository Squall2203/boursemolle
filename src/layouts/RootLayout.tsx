import { useState, useRef, useEffect } from "react"
import { X, Moon, Sun, User, LayoutDashboard, Trophy, LogOut, ChevronDown, Sparkles } from "lucide-react"
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SearchCommand } from "@/components/SearchCommand"
import { ViewModeToggle } from "@/components/ViewModeToggle"
import { AuthModal } from "@/components/AuthModal"
import { BuySellModal } from "@/components/portfolio/BuySellModal"
import { XPNotification } from "@/components/XPNotification"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"
import { useViewMode } from "@/hooks/useViewMode"
import { useAuth } from "@/contexts/AuthContext"

function UserMenu() {
  const { user, signOut, openAuthModal } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={openAuthModal}>
          Connexion
        </Button>
        <Button size="sm" onClick={openAuthModal}>
          S'inscrire
        </Button>
      </div>
    )
  }

  const initial = (user.email ?? "U")[0].toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm hover:bg-muted"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initial}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border bg-popover p-1 shadow-lg">
          <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
            {user.email}
          </p>
          <div className="my-1 border-t" />
          <button
            type="button"
            onClick={() => { navigate("/portfolio"); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" />
            Mon Paper PEA
          </button>
          <button
            type="button"
            onClick={() => { navigate("/profile"); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <User className="size-4 text-muted-foreground" />
            Mon profil
          </button>
          <button
            type="button"
            onClick={() => { navigate("/leaderboard"); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Trophy className="size-4 text-muted-foreground" />
            Classement
          </button>
          <div className="my-1 border-t" />
          <button
            type="button"
            onClick={async () => { await signOut(); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="size-4" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}

export function RootLayout() {
  const { theme, toggle } = useTheme()
  const { showExpertHint, dismissHint, setMode } = useViewMode()
  const location = useLocation()
  const showViewToggle = location.pathname === "/screener" || location.pathname.startsWith("/stock/")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-baseline gap-1">
            <span className="text-lg font-bold tracking-tight">Bourse</span>
            <span className="text-lg font-bold tracking-tight text-primary">
              Molle
            </span>
          </Link>
          <SearchCommand />
          <nav className="flex items-center gap-3 text-sm">
            {showViewToggle && <ViewModeToggle />}
            <NavLink
              to="/screener"
              className={({ isActive }) =>
                cn(
                  "transition-colors hover:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )
              }
            >
              Screener
            </NavLink>
            <NavLink
              to="/compare"
              className={({ isActive }) =>
                cn(
                  "transition-colors hover:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )
              }
            >
              Comparer
            </NavLink>
            <NavLink
              to="/picks"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1 transition-colors hover:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )
              }
            >
              <Sparkles className="size-3.5" />
              AlphaPicks
            </NavLink>
            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                cn(
                  "transition-colors hover:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )
              }
            >
              <Trophy className="inline size-3.5 -mt-0.5 mr-0.5" />
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggle}
              aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
            <UserMenu />
          </nav>
        </div>
      </header>
      {showExpertHint && (
        <div className="border-b bg-primary/5 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 text-sm">
            <p className="text-muted-foreground">
              Vous êtes en mode <span className="font-medium text-foreground">Simple</span>.{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setMode("expert")}
              >
                Passer en mode Expert
              </button>{" "}
              pour voir le détail des scores et toutes les métriques.
            </p>
            <button
              type="button"
              onClick={dismissHint}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="mt-12 border-t py-6">
        <div className="mx-auto max-w-[1600px] px-4 text-center text-xs text-muted-foreground sm:px-6 space-y-2">
          <p>BourseMolle — Données fournies à titre informatif uniquement, ne constitue pas un conseil en investissement.</p>
          <div className="flex items-center justify-center gap-4">
            <NavLink to="/methodologie" className="hover:text-foreground transition-colors">Méthodologie</NavLink>
            <NavLink to="/data-freshness" className="hover:text-foreground transition-colors">État des données</NavLink>
          </div>
        </div>
      </footer>
      <AuthModal />
      <BuySellModal />
      <XPNotification />
    </div>
  )
}
