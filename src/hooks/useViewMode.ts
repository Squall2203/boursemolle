import { useCallback, useSyncExternalStore } from "react"

export type ViewMode = "simple" | "expert"

const STORAGE_KEY = "boursemolle_view_mode"

let currentMode: ViewMode = (localStorage.getItem(STORAGE_KEY) as ViewMode) || "simple"
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getSnapshot(): ViewMode {
  return currentMode
}

export function useViewMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot)

  const setMode = useCallback((m: ViewMode) => {
    currentMode = m
    localStorage.setItem(STORAGE_KEY, m)
    notify()
  }, [])

  const toggle = useCallback(() => {
    setMode(currentMode === "simple" ? "expert" : "simple")
  }, [setMode])

  return { mode, setMode, toggle, isSimple: mode === "simple", isExpert: mode === "expert" }
}
