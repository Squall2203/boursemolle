import { Moon, Sun } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SearchCommand } from "@/components/SearchCommand"
import { ViewModeToggle } from "@/components/ViewModeToggle"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"

export function RootLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <Link to="/screener" className="flex items-baseline gap-1">
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
