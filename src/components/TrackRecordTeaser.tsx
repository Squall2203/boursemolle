import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Scale } from "lucide-react"

interface Summary {
  firstDate: string | null
  meanTopExcess: number | null
  meanBottomExcess: number | null
  independent: { n: number; spreadPositive: number }
}

const pt = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} point${Math.abs(v) >= 2 ? "s" : ""}`

/**
 * Résumé, sur l'accueil, de ce que les notes ont réellement donné. Les phrases sont construites à
 * partir des chiffres mesurés chaque semaine : si la mesure devient défavorable, le texte le dira aussi.
 */
export function TrackRecordTeaser() {
  const [s, setS] = useState<Summary | null>(null)

  useEffect(() => {
    fetch("/data/score-evaluation.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const pea = d?.universes?.find((u: { id: string }) => u.id === "pea")
        setS(pea?.horizons?.find((h: { sessions: number }) => h.sessions === 21)?.summary ?? null)
      })
      .catch(() => setS(null))
  }, [])

  if (!s || s.meanTopExcess == null || s.meanBottomExcess == null || s.independent.n === 0) return null

  const since = s.firstDate
    ? new Date(s.firstDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null
  const top = s.meanTopExcess
  const bottom = s.meanBottomExcess
  const describe = (v: number) =>
    Math.abs(v) < 0.1 ? "comme la moyenne" : v > 0 ? `${pt(v)} de mieux que la moyenne` : `${pt(Math.abs(v))} de moins que la moyenne`

  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="bilan-notes-titre">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Scale className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 id="bilan-notes-titre" className="text-base font-semibold">Nos notes, vérifiées chaque semaine</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Une note ne vaut que si elle se vérifie ensuite. {since ? `Depuis ${since}, ` : ""}parmi les actions
            éligibles au PEA, celles notées 7 ou plus ont fait en moyenne{" "}
            <span className="font-medium text-foreground">{describe(top)}</span> le mois suivant, et celles notées
            moins de 5, <span className="font-medium text-foreground">{describe(bottom)}</span>. Les mieux notées ont
            devancé les moins bien notées {s.independent.spreadPositive} mois sur {s.independent.n}.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            C'est encore très peu de recul pour conclure, et nous publions aussi ce qui marche moins bien.
          </p>
          <Link to="/methodologie" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Voir la mesure complète et ses limites <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
