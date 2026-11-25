import { Link } from "react-router-dom"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GLOSSARY_BY_ID, splitGlossaryTerms } from "@/lib/glossary"

/** Un terme du lexique : souligné en pointillés, sa définition s'ouvre au clic (ou au toucher sur mobile). */
export function GlossaryTerm({ id, children }: { id: string; children: React.ReactNode }) {
  const entry = GLOSSARY_BY_ID.get(id)
  if (!entry) return <>{children}</>

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Le terme est souvent dans une ligne elle-même cliquable : le clic ne doit ouvrir que la définition
          onClick={(e) => e.stopPropagation()}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-[3px] hover:decoration-primary hover:text-foreground"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-1.5 p-3 text-xs leading-relaxed" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-foreground">{entry.term}</p>
        <p className="text-foreground">{entry.short}</p>
        <p className="text-muted-foreground">{entry.more}</p>
        <Link to={`/lexique#${entry.id}`} className="inline-block pt-0.5 font-medium text-primary hover:underline">
          Voir tout le lexique
        </Link>
      </PopoverContent>
    </Popover>
  )
}

/** Affiche un texte en rendant cliquables les termes du lexique qu'il contient. */
export function GlossaryText({ children }: { children: string }) {
  const segments = splitGlossaryTerms(children)
  return (
    <>
      {segments.map((seg, i) =>
        seg.entryId ? <GlossaryTerm key={i} id={seg.entryId}>{seg.text}</GlossaryTerm> : <span key={i}>{seg.text}</span>,
      )}
    </>
  )
}
