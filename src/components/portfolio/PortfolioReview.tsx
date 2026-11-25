import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { GlossaryText } from "@/components/glossary/GlossaryText"
import { reviewPortfolio, type FindingTone, type ReviewInput } from "@/lib/portfolioReview"
import { cn } from "@/lib/utils"

const TONE: Record<FindingTone, { icon: React.ReactNode; border: string }> = {
  good: { icon: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />, border: "border-l-emerald-500/50" },
  warn: { icon: <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />, border: "border-l-orange-500/60" },
  info: { icon: <Info className="size-4 text-muted-foreground" />, border: "border-l-border" },
}

/** Bilan rédigé du portefeuille : ce qu'il a donné face à l'indice et ce que sa composition implique. */
export function PortfolioReview(props: ReviewInput) {
  const review = reviewPortfolio(props)

  return (
    <section className="rounded-xl border bg-card px-4 py-4 sm:px-5" aria-labelledby="bilan-titre">
      <h2 id="bilan-titre" className="text-base font-semibold">Le bilan de votre portefeuille</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Ce que vos choix ont donné, et ce que la composition du portefeuille implique. Rien ici n'est un conseil d'achat ou de vente.
      </p>

      <ul className="mt-4 space-y-3">
        {review.findings.map((f) => (
          <li key={f.id} className={cn("border-l-2 pl-3", TONE[f.tone].border)}>
            <p className="flex items-start gap-1.5 text-sm font-medium">
              <span className="mt-0.5 shrink-0">{TONE[f.tone].icon}</span>
              {f.title}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              <GlossaryText>{f.text}</GlossaryText>
            </p>
          </li>
        ))}
      </ul>

      {review.sectors.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium">Répartition de vos actions par secteur</h3>
          <div className="mt-2 space-y-1.5">
            {review.sectors.map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-xs">
                <span className="w-40 shrink-0 truncate text-muted-foreground">{s.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", s.weight > 40 ? "bg-orange-500" : "bg-primary")}
                    style={{ width: `${Math.max(s.weight, 1.5)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono tabular-nums">{Math.round(s.weight)} %</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
