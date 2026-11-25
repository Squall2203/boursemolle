import { useState } from "react"
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { GlossaryText } from "@/components/glossary/GlossaryText"
import type { MetricDetail, PillarKey, StockScore } from "@/lib/scoring"

const PILLAR_ORDER: PillarKey[] = ["valorisation", "qualite", "croissance", "sante", "dividende", "momentum", "quant"]

function noteColor(score: number): string {
  if (score >= 7) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 4.5) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}

function barColor(score: number): string {
  if (score >= 7) return "bg-emerald-500"
  if (score >= 4.5) return "bg-yellow-500"
  return "bg-red-500"
}

function fr(v: number, digits = 1): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// ─── Les raisons principales de la note ───────────────────────────────────────

export function ScoreHighlights({ score }: { score: StockScore }) {
  if (score.strengths.length === 0 && score.watchPoints.length === 0) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Ce qui tire la note vers le haut
        </h3>
        {score.strengths.length > 0 ? (
          <ul className="space-y-2">
            {score.strengths.map((text) => (
              <li key={text} className="border-l-2 border-emerald-500/40 pl-3 text-sm leading-relaxed text-muted-foreground">
                <GlossaryText>{text}</GlossaryText>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun chiffre ne se détache nettement en bien.</p>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
          <AlertTriangle className="size-4" />
          Ce qui la tire vers le bas, ou à surveiller
        </h3>
        {score.watchPoints.length > 0 ? (
          <ul className="space-y-2">
            {score.watchPoints.map((text) => (
              <li key={text} className="border-l-2 border-orange-500/40 pl-3 text-sm leading-relaxed text-muted-foreground">
                <GlossaryText>{text}</GlossaryText>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun point faible marqué dans les chiffres disponibles.</p>
        )}
      </div>
    </div>
  )
}

// ─── Détail d'un chiffre (mode expert) ────────────────────────────────────────

function MetricRow({ metric }: { metric: MetricDetail }) {
  if (metric.excluded || metric.missing) {
    return (
      <div className="flex items-center gap-2 opacity-60">
        <Ban className="size-3 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-muted-foreground">{metric.label}</div>
        <div className="text-right text-xs italic text-muted-foreground">
          {metric.excluded ? metric.excludedReason : "Donnée non disponible, non comptée"}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-muted-foreground">{metric.label}</div>
        <div className="text-right font-mono tabular-nums">{metric.displayValue}</div>
        <div className={cn("w-8 text-right font-mono font-semibold tabular-nums", noteColor(metric.note))}>
          {fr(metric.note)}
        </div>
        <div className="hidden w-16 sm:block">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", barColor(metric.note))} style={{ width: `${Math.max(metric.note * 10, 2)}%` }} />
          </div>
        </div>
      </div>
      {metric.sectorMedian != null && (
        <div className="pl-2 text-[11px] text-muted-foreground/80">
          Médiane du secteur : <span className="font-mono">{fr(metric.sectorMedian)}</span>
          {metric.sectorPercentile != null && (
            <> · au-dessus de {metric.sectorPercentile} % des sociétés comparables</>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Les critères un par un, expliqués ────────────────────────────────────────

interface PillarExplanationsProps {
  score: StockScore
  /** Affiche aussi le tableau chiffré (valeur, note, médiane du secteur) de chaque critère */
  showFigures?: boolean
}

export function PillarExplanations({ score, showFigures = false }: PillarExplanationsProps) {
  const [open, setOpen] = useState<PillarKey | null>(null)

  return (
    <div className="divide-y divide-border/60">
      {PILLAR_ORDER.map((key) => {
        const exp = score.explanations[key]
        const val = score.pillars[key]
        const isOpen = open === key
        const weightPct = Math.round(score.weights[key] * 100)

        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", exp.counted ? barColor(val) : "bg-muted-foreground/30")} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{exp.title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{exp.verdict}</span>
              </span>
              <span className="shrink-0 text-right">
                {exp.counted ? (
                  <span className={cn("block font-mono text-sm font-semibold tabular-nums", noteColor(val))}>
                    {fr(val)}<span className="text-xs font-normal text-muted-foreground"> /10</span>
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground">Non compté</span>
                )}
                {exp.counted && (
                  <span className="block text-[10px] text-muted-foreground">{weightPct} % de la note</span>
                )}
              </span>
              {isOpen ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="space-y-3 px-2 pb-4 pt-1 sm:pl-8">
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                  <span className="font-medium">Ce que ce critère cherche à savoir. </span>
                  <span className="text-muted-foreground"><GlossaryText>{exp.question}</GlossaryText></span>
                </p>
                {exp.points.length > 0 && (
                  <ul className="space-y-2">
                    {exp.points.map((text) => (
                      <li key={text} className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                        <GlossaryText>{text}</GlossaryText>
                      </li>
                    ))}
                  </ul>
                )}
                {showFigures && (
                  <div className="space-y-2 border-t border-border/60 pt-3 text-xs">
                    <p className="font-medium uppercase tracking-wider text-muted-foreground">Chiffres et notes</p>
                    {Object.entries(score.details[key]).map(([metricKey, metric]) => (
                      <MetricRow key={metricKey} metric={metric} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Carte complète « Pourquoi cette note » ───────────────────────────────────

export function ScoreExplanationCard({ score, showFigures = false }: PillarExplanationsProps) {
  const coveragePct = Math.round(score.dataCoverage * 100)

  return (
    <Card>
      <CardContent className="space-y-5 pt-5 pb-4">
        <div>
          <h2 className="text-base font-semibold">Pourquoi cette note</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            La note sur 10 est une moyenne de sept critères, chacun noté à partir de chiffres publics de l'entreprise.
            La plupart sont comparés aux sociétés du même secteur, car un prix ou une marge ne se jugent pas de la même
            façon pour une banque et pour un éditeur de logiciels. Elle décrit la situation actuelle, pas l'avenir.
          </p>
        </div>

        <ScoreHighlights score={score} />

        <div>
          <h3 className="mb-1 text-sm font-semibold">Les sept critères, un par un</h3>
          <p className="mb-2 text-xs text-muted-foreground">Ouvrez un critère pour lire ce qu'il mesure et ce que disent les chiffres de cette action.</p>
          <PillarExplanations score={score} showFigures={showFigures} />
        </div>

        {coveragePct < 100 && (
          <p className="text-xs text-muted-foreground">
            {coveragePct} % des chiffres nécessaires sont disponibles pour cette action. Les chiffres absents ne sont pas
            comptés, et la note est rapprochée de la moyenne quand il en manque beaucoup.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
