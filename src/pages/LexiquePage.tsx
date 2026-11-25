import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { Search } from "lucide-react"
import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary"
import { usePageMeta } from "@/hooks/usePageMeta"
import { cn } from "@/lib/utils"

const CATEGORIES: GlossaryEntry["category"][] = [
  "Les bases", "Le prix d'une action", "La rentabilité", "La solidité", "Le dividende", "Le cours",
]

export function LexiquePage() {
  usePageMeta(
    "Lexique de la Bourse pour débutants",
    "PER, ROE, dividende, PEA, capitalisation… Les termes de la Bourse expliqués en une phrase, sans jargon.",
  )
  const [query, setQuery] = useState("")
  const { hash } = useLocation()

  // Arrivée depuis une définition : on se place sur le terme demandé
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" })
  }, [hash])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.filter((e) =>
      [e.term, e.short, ...e.match].some((t) => t.toLowerCase().includes(q)),
    )
  }, [query])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lexique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les termes de la Bourse utilisés sur le site, expliqués simplement. Partout ailleurs, les mots soulignés
          en pointillés ouvrent leur définition.
        </p>
      </div>

      <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un terme (PER, dividende, PEA…)"
          aria-label="Chercher un terme"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun terme ne correspond à « {query} ».</p>
      )}

      {CATEGORIES.map((category) => {
        const entries = filtered.filter((e) => e.category === category)
        if (entries.length === 0) return null
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2>
            <dl className="divide-y divide-border rounded-xl border bg-card">
              {entries.map((e) => (
                <div
                  key={e.id}
                  id={e.id}
                  className={cn("scroll-mt-24 px-4 py-3.5", hash === `#${e.id}` && "bg-primary/5")}
                >
                  <dt className="text-sm font-semibold">{e.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed">{e.short}</dd>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.more}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}
