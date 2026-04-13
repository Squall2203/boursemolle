import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FLAG_CATALOG } from "@/lib/scoring"
import { cn } from "@/lib/utils"

const PILLAR_INFO = [
  { name: "Valorisation", weight: "20%", desc: "P/E, P/B, EV/EBITDA comparés aux médianes sectorielles. Un ratio inférieur à la médiane = bien valorisé." },
  { name: "Qualité", weight: "20%", desc: "ROE, ROA, marges opérationnelles et nettes vs le secteur. Mesure l'efficacité du capital." },
  { name: "Croissance", weight: "15%", desc: "Croissance du CA et du BPA. Vérifie si l'entreprise est en expansion." },
  { name: "Santé financière", weight: "15%", desc: "Debt/Equity, dette nette / capitalisation, constance des profits. Évalue la solidité du bilan." },
  { name: "Dividende", weight: "10%", desc: "Rendement, payout ratio, historique de croissance du dividende." },
  { name: "Momentum", weight: "10%", desc: "RSI, performance 1M/3M/6M, position par rapport aux moyennes mobiles." },
  { name: "Quant", weight: "10%", desc: "Distance au consensus (P/E forward vs trailing), écart au plus haut 52 semaines, tendance des résultats." },
]

const RATIO_GRILLE = [
  { ratio: "< 0.5", note: "10/10", interpretation: "Très en dessous de la médiane sectorielle" },
  { ratio: "0.5 – 0.7", note: "8/10", interpretation: "Nettement en dessous de la médiane" },
  { ratio: "0.7 – 0.9", note: "6/10", interpretation: "Légèrement sous la médiane" },
  { ratio: "0.9 – 1.1", note: "5/10", interpretation: "Autour de la médiane (neutre)" },
  { ratio: "1.1 – 1.3", note: "4/10", interpretation: "Légèrement au-dessus de la médiane" },
  { ratio: "1.3 – 1.5", note: "2/10", interpretation: "Nettement supérieur à la médiane" },
  { ratio: "> 1.5", note: "0/10", interpretation: "Très au-dessus de la médiane sectorielle" },
]

export function MethodologiePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link to="/screener">
          <ArrowLeft className="size-4" />
          Screener
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Méthodologie de scoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comment Bourse Molle note chaque action sur 10.
        </p>
      </div>

      {/* Principe général */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Principe : scoring calibré par secteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Comparer le P/E d'une banque à celui d'une entreprise tech n'a pas de sens.
            C'est pourquoi chaque métrique est comparée à la <strong className="text-foreground">médiane de son secteur GICS</strong>.
          </p>
          <p>
            On calcule un <strong className="text-foreground">ratio vs médiane</strong> : si le P/E de l'action est 12 et la médiane sectorielle 18,
            le ratio est 12/18 = 0.67x. Ce ratio est ensuite converti en note via la grille ci-dessous.
          </p>
          <p>
            Pour les métriques où <em>plus haut = mieux</em> (ROE, marges...), la grille est inversée :
            un ratio &gt; 1 signifie que l'entreprise fait mieux que son secteur.
          </p>
        </CardContent>
      </Card>

      {/* Grille ratio → note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grille de conversion ratio → note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Pour les métriques "plus bas = mieux" (P/E, EV/EBITDA, Debt/Equity).
            La grille est inversée pour les métriques "plus haut = mieux".
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ratio vs médiane</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Interprétation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RATIO_GRILLE.map((row) => (
                <TableRow key={row.ratio}>
                  <TableCell className="font-mono text-xs">{row.ratio}</TableCell>
                  <TableCell className="font-mono font-semibold text-xs">{row.note}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.interpretation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 7 piliers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Les 7 piliers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Le score final est la moyenne pondérée des 7 piliers.
          </p>
          <div className="space-y-3">
            {PILLAR_INFO.map((p) => (
              <div key={p.name} className="flex gap-3">
                <div className="w-10 text-right font-mono text-xs font-semibold text-primary shrink-0 pt-0.5">{p.weight}</div>
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signaux / badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Les 10 signaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Des badges contextuels détectés automatiquement. Ils ne modifient pas le score mais signalent
            des situations particulières.
          </p>
          <div className="grid gap-2">
            {FLAG_CATALOG.map((flag) => (
              <div
                key={flag.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  flag.type === "positive"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5",
                )}
              >
                <span className="text-base">{flag.emoji}</span>
                <span className="font-medium">{flag.label}</span>
                <span className={cn(
                  "ml-auto text-[10px] uppercase tracking-wide font-semibold",
                  flag.type === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}>
                  {flag.type === "positive" ? "Positif" : "Négatif"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limites et avertissements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Ce scoring est un outil d'aide à la décision, pas un conseil d'investissement.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Les données proviennent de Yahoo Finance et peuvent contenir des erreurs ou retards.</li>
            <li>Quand un secteur compte moins de 5 actions dans l'univers, la calibration sectorielle est moins fiable.</li>
            <li>Les métriques manquantes reçoivent une note neutre (5/10) pour ne pas pénaliser injustement.</li>
            <li>Les secteurs financiers (banques, assurances) et immobiliers ont des ajustements spécifiques.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
