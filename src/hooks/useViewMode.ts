import { useCallback, useSyncExternalStore } from "react"

export type ViewMode = "simple" | "expert"

const STORAGE_KEY = "boursemolle_view_mode"
const HINT_KEY = "boursemolle_expert_hint_seen"

let currentMode: ViewMode = (localStorage.getItem(STORAGE_KEY) as ViewMode) || "simple"
const listeners = new Set<() => void>()

let hintDismissed = localStorage.getItem(HINT_KEY) === "1"
const hintListeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function notifyHint() {
  for (const l of hintListeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function subscribeHint(cb: () => void) {
  hintListeners.add(cb)
  return () => { hintListeners.delete(cb) }
}

function getSnapshot(): ViewMode {
  return currentMode
}

function getHintSnapshot(): boolean {
  return hintDismissed
}

export function useViewMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot)
  const hintDismissedState = useSyncExternalStore(subscribeHint, getHintSnapshot)

  const setMode = useCallback((m: ViewMode) => {
    currentMode = m
    localStorage.setItem(STORAGE_KEY, m)
    // dismiss hint as soon as user manually switches to expert
    if (m === "expert" && !hintDismissed) {
      hintDismissed = true
      localStorage.setItem(HINT_KEY, "1")
      notifyHint()
    }
    notify()
  }, [])

  const toggle = useCallback(() => {
    setMode(currentMode === "simple" ? "expert" : "simple")
  }, [setMode])

  const dismissHint = useCallback(() => {
    hintDismissed = true
    localStorage.setItem(HINT_KEY, "1")
    notifyHint()
  }, [])

  const showExpertHint = mode === "simple" && !hintDismissedState

  return { mode, setMode, toggle, dismissHint, showExpertHint, isSimple: mode === "simple", isExpert: mode === "expert" }
}
