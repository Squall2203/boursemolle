import { useState } from "react"
import { Bookmark, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ScreenerFilters } from "@/types/filters"

interface SavedScreener {
  name: string
  filters: ScreenerFilters
  savedAt: string
}

const LS_KEY = "boursemolle-saved-screeners"

function loadSaved(): SavedScreener[] {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v) return JSON.parse(v) as SavedScreener[]
  } catch { /* ignore localStorage errors */ }
  return []
}

function persistSaved(screeners: SavedScreener[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(screeners)) } catch { /* ignore */ }
}

interface SavedScreenersProps {
  filters: ScreenerFilters
  onLoad: (filters: ScreenerFilters) => void
}

export function SavedScreeners({ filters, onLoad }: SavedScreenersProps) {
  const [saved, setSaved] = useState<SavedScreener[]>(loadSaved)
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const entry: SavedScreener = {
      name: trimmed,
      filters: { ...filters },
      savedAt: new Date().toISOString(),
    }
    const next = [...saved.filter((s) => s.name !== trimmed), entry]
    setSaved(next)
    persistSaved(next)
    setName("")
  }

  function handleDelete(screenName: string) {
    const next = saved.filter((s) => s.name !== screenName)
    setSaved(next)
    persistSaved(next)
  }

  function handleLoad(s: SavedScreener) {
    onLoad(s.filters)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Bookmark className="size-3.5" />
          Mes screeners
          {saved.length > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
              {saved.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Screeners sauvegardés
          </p>
          {saved.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun screener sauvegardé.
            </p>
          ) : (
            <div className="space-y-1">
              {saved.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-sm font-medium truncate"
                    onClick={() => handleLoad(s)}
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.name)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du screener..."
              className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
