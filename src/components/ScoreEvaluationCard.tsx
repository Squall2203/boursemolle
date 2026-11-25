import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface HorizonSummary {
  nDates: number
  independent: { n: number; icPositive: number; spreadPositive: number; meanIc: number }
  firstDate: string | null
  lastDate: string | null
  avgNames: number
  meanIc: number
  medianSpread: number
  datesSpreadPositive: number
  meanTopExcess: number | null
  meanBottomExcess: number | null
  pillarIc: Record<string, number>
}

interface ScoreEvaluation {
  generatedAt: string
  universes: { id: string; label: string; horizons: { sessions: number; summary: HorizonSummary }[] }[]
}

const PILLAR_NAMES: Record<string, string> = {
  valorisation: "Valorisation", qualite: "Rentabilité", croissance: "Croissance", sante: "Solidité financière",
  dividende: "Dividende", momentum: "Tendance du cours", quant: "Signaux complémentaires",
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "?"
const signed = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt`)
const tone = (v: number | null) =>
  v == null || v === 0 ? "" : v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"

/** Tableau commun aux deux mesures : une ligne par groupe d'actions comparées. */
function EvaluationTable({ rows, periodsLabel }: { rows: { label: string; s: HorizonSummary }[]; periodsLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Actions comparées</th>
            <th className="px-3 py-2 text-right font-medium">Notées 7 ou plus</th>
            <th className="px-3 py-2 text-right font-medium">Notées moins de 5</th>
            <th className="px-3 py-2 text-right font-medium">Meilleur cinquième contre le moins bon</th>
            <th className="px-3 py-2 text-right font-medium">{periodsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, s }) => (
            <tr key={label} className="border-b last:border-0">
              <td className="px-3 py-2 text-foreground">
                {label}
                <span className="block text-[11px] text-muted-foreground">environ {s.avgNames} actions</span>
              </td>
              <td className={cn("px-3 py-2 text-right font-mono tabular-nums", tone(s.meanTopExcess))}>{signed(s.meanTopExcess)}</td>
              <td className={cn("px-3 py-2 text-right font-mono tabular-nums", tone(s.meanBottomExcess))}>{signed(s.meanBottomExcess)}</td>
              <td className={cn("px-3 py-2 text-right font-mono tabular-nums", tone(s.medianSpread))}>{signed(s.medianSpread)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                {s.datesSpreadPositive} sur {s.nDates}
                {s.independent.n !== s.nDates && (
                  <span className="block text-[11px] font-sans text-muted-foreground">
                    dont {s.independent.spreadPositive} sur {s.independent.n} distinctes
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Ce que les notes ont réellement donné depuis que le site conserve ses données. */
export function ScoreEvaluationCard() {
  const [data, setData] = useState<ScoreEvaluation | null>(null)
  const [history, setHistory] = useState<ScoreEvaluation | null>(null)

  useEffect(() => {
    fetch("/data/score-evaluation.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
    fetch("/data/score-evaluation-history.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setHistory)
      .catch(() => setHistory(null))
  }, [])

  if (!data) return null
  // Horizon d'un mois : c'est celui qui offre le plus de périodes réellement distinctes
  const rows = data.universes
    .map((u) => ({ label: u.label, s: u.horizons.find((h) => h.sessions === 21)?.summary }))
    .filter((r): r is { label: string; s: HorizonSummary } => r.s != null && r.s.nDates > 0)
  if (rows.length === 0) return null

  const ref = rows[0].s
  // Les phrases de conclusion dépendent des chiffres : la mesure est recalculée chaque semaine
  const avoidsMoreThanPicks = (ref.meanBottomExcess ?? 0) < 0 && (ref.meanTopExcess ?? 0) < Math.abs(ref.meanBottomExcess ?? 0)
  const large = data.universes.find((u) => u.id === "peaLarge")?.horizons.find((h) => h.sessions === 21)?.summary
  const weakerOnLargeCaps = large != null && ref.medianSpread > 0 && large.medianSpread < ref.medianSpread / 2
  const pillars = Object.entries(ref.pillarIc).sort((a, b) => b[1] - a[1])

  // Mesure sur plusieurs années, à partir de notes reconstituées (rendement de l'année suivante)
  const historyRows = (history?.universes ?? [])
    .map((u) => ({ label: u.label, s: u.horizons.find((h) => h.sessions === 252)?.summary }))
    .filter((r): r is { label: string; s: HorizonSummary } => r.s != null && r.s.nDates > 0)
  const historyRef = historyRows[0]?.s

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ce que les notes ont donné jusqu'ici</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          Une note n'a d'intérêt que si les actions bien notées font, en moyenne, mieux que les autres.
          Nous le vérifions sur les données réellement publiées par le site : chaque semaine depuis {fmtDate(ref.firstDate)},
          la note de chaque action est recalculée avec les chiffres de l'époque, puis comparée à ce que l'action a
          fait pendant le mois suivant.
        </p>

        <EvaluationTable rows={rows} periodsLabel="Semaines favorables" />

        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
          <li>
            Les deux premières colonnes donnent le rendement moyen sur un mois, comparé à la moyenne de toutes
            les actions du groupe. La troisième compare le cinquième le mieux noté au cinquième le moins bien noté.
          </li>
          {avoidsMoreThanPicks && (
            <li>
              <strong className="text-foreground">Lecture prudente :</strong> jusqu'ici, la note a surtout servi à
              repérer les actions à éviter : les mal notées ont décroché plus nettement que les bien notées n'ont
              pris d'avance.
              {weakerOnLargeCaps && " L'écart est aussi bien plus faible parmi les sociétés de plus d'un milliard d'euros que parmi les petites."}
            </li>
          )}
          <li>
            <strong className="text-foreground">C'est très peu de recul.</strong> La mesure couvre {ref.independent.n} mois
            distincts. Un résultat favorable sur une durée aussi courte peut tenir au
            hasard ou à la conjoncture : il faudra plusieurs années pour conclure.
          </li>
          <li>
            Critères les plus liés au rendement du mois suivant, du plus au moins :{" "}
            {pillars.map(([k]) => PILLAR_NAMES[k] ?? k).join(", ")}.
          </li>
        </ul>
        {historyRef && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground">Et sur plusieurs années ?</h3>
            <p>
              Quelques mois, c'est court. Pour remonter plus loin, nous avons reconstitué la note que chaque action aurait
              eue deux fois par an depuis {fmtDate(historyRef.firstDate)}, à partir des comptes annuels déjà publiés à
              chaque date et des cours de l'époque, puis regardé ce que l'action a fait pendant l'année suivante.
            </p>
            <EvaluationTable rows={historyRows} periodsLabel="Dates favorables" />
            <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
              <li>
                Ici, les deux premières colonnes donnent le rendement moyen sur <strong className="text-foreground">un an</strong>,
                comparé à la moyenne du groupe.
              </li>
              <li>
                <strong className="text-foreground">Ce sont des notes reconstituées, pas des notes publiées.</strong> La date
                de publication des comptes est supposée (quatre mois après la clôture), les prévisions d'analystes de
                l'époque ne sont plus disponibles, et le secteur comme les taux de change sont ceux d'aujourd'hui.
              </li>
              <li>
                Les sociétés qui ont quitté la cote entre-temps ne figurent pas dans cette mesure, faute de données.
              </li>
              <li>
                {historyRef.independent.n} années distinctes seulement : les dates espacées de six mois partagent la
                moitié de leur période. C'est mieux que quelques mois, pas encore une preuve.
              </li>
            </ul>
          </div>
        )}

        <p className="text-[11px]">
          Mesure mise à jour chaque semaine, dernière le {new Date(data.generatedAt).toLocaleDateString("fr-FR")}.
          Rendements hors dividendes et hors frais, en devise de cotation ; les 2,5 % de rendements les plus extrêmes de chaque côté sont plafonnés.
        </p>
      </CardContent>
    </Card>
  )
}
