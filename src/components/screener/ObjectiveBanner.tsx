import { X } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { GlossaryText } from "@/components/glossary/GlossaryText"
import { getObjective } from "@/lib/objectives"

/** Rappelle, en haut du screener, ce que fait la sélection choisie depuis l'accueil. */
export function ObjectiveBanner({ resultCount }: { resultCount: number }) {
  const [params, setParams] = useSearchParams()
  const objective = getObjective(params.get("objectif"))
  if (!objective) return null

  function dismiss() {
    const next = new URLSearchParams(params)
    next.delete("objectif")
    setParams(next, { replace: true })
  }

  return (
    <div className="relative rounded-xl border border-primary/25 bg-primary/5 px-4 py-3.5 pr-10">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer cette explication"
        className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <p className="text-sm font-semibold">{objective.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Ce que vous voyez : </span>
        <GlossaryText>{objective.what}</GlossaryText>{" "}
        {resultCount > 0
          ? `${resultCount} action${resultCount > 1 ? "s" : ""} éligible${resultCount > 1 ? "s" : ""} au PEA correspond${resultCount > 1 ? "ent" : ""} aujourd'hui, classées de la mieux notée à la moins bien notée.`
          : "Aucune action éligible au PEA ne remplit tous ces critères aujourd'hui."}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">À garder en tête : </span>
        <GlossaryText>{objective.caution}</GlossaryText>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Cliquez sur une action pour lire l'explication détaillée de sa note. Ce classement est une aide à l'analyse, pas un conseil d'achat.
      </p>
    </div>
  )
}
