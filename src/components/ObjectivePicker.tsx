import { Link } from "react-router-dom"
import { ArrowRight, Coins, Search, ShieldCheck, TrendingUp } from "lucide-react"
import { OBJECTIVES, objectiveUrl } from "@/lib/objectives"

const ICONS: Record<string, React.ReactNode> = {
  revenus: <Coins className="size-5" />,
  croissance: <TrendingUp className="size-5" />,
  prudence: <ShieldCheck className="size-5" />,
  decouverte: <Search className="size-5" />,
}

/** Point de départ pour un débutant : choisir un objectif plutôt que régler des filtres. */
export function ObjectivePicker() {
  return (
    <section className="space-y-3" aria-labelledby="objectifs-titre">
      <div>
        <h2 id="objectifs-titre" className="text-lg font-semibold">Par où commencer ?</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez ce que vous cherchez : le site présélectionne des actions éligibles au PEA et vous explique pourquoi.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OBJECTIVES.map((o) => (
          <Link
            key={o.id}
            to={objectiveUrl(o)}
            className="group flex flex-col rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {ICONS[o.id]}
            </div>
            <h3 className="text-sm font-semibold leading-snug">{o.title}</h3>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">{o.need}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-all group-hover:gap-1.5">
              Voir les actions <ArrowRight className="size-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
