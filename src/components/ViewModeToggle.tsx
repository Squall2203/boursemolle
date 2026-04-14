import { cn } from "@/lib/utils"
import { useViewMode } from "@/hooks/useViewMode"

export function ViewModeToggle() {
  const { mode, setMode } = useViewMode()

  return (
    <div className="flex items-center rounded-full border bg-muted/50 p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => setMode("simple")}
        className={cn(
          "rounded-full px-3 py-1 transition-all",
          mode === "simple"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Simple
      </button>
      <button
        type="button"
        onClick={() => setMode("expert")}
        className={cn(
          "rounded-full px-3 py-1 transition-all",
          mode === "expert"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Expert
      </button>
    </div>
  )
}
