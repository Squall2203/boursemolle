import { X, Moon, Sun } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SearchCommand } from "@/components/SearchCommand"
import { ViewModeToggle } from "@/components/ViewModeToggle"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"
import { useViewMode } from "@/hooks/useViewMode"

export function RootLayout() {
  const { theme, toggle } = useTheme()
  const { showExpertHint, dismissHint, setMode } = useViewMode()

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
          <nav className="flex items-center gap-4 text-sm">
            <ViewModeToggle />
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
              to="/methodologie"
              className={({ isActive }) =>
                cn(
                  "transition-colors hover:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )
              }
            >
              Méthodo
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggle}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
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
        <div className="mx-auto max-w-[1600px] px-4 text-center text-xs text-muted-foreground sm:px-6">
          BourseMolle — Données fournies à titre informatif uniquement, ne
          constitue pas un conseil en investissement.
        </div>
      </footer>
    </div>
  )
}
