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
import { ScoreEvaluationCard } from "@/components/ScoreEvaluationCard"
import { FLAG_CATALOG, getPillarCatalog } from "@/lib/scoring"
import { cn } from "@/lib/utils"

const PILLARS = getPillarCatalog()

const GRADES = [
  { range: "9 à 10", letter: "A+", label: "Excellent" },
  { range: "8 à 8,9", letter: "A", label: "Très bon" },
  { range: "7 à 7,9", letter: "B+", label: "Bon" },
  { range: "6 à 6,9", letter: "B", label: "Correct" },
  { range: "5 à 5,9", letter: "C", label: "Moyen" },
  { range: "4 à 4,9", letter: "D", label: "Faible" },
  { range: "moins de 4", letter: "F", label: "À éviter" },
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
        <h1 className="text-2xl font-bold tracking-tight">Comment les notes sont calculées</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comment Bourse Molle note chaque action sur 10.
        </p>
      </div>

      {/* Principe général */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Le principe : comparer chaque action à ses semblables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Comparer le prix d'une banque à celui d'un éditeur de logiciels n'a pas de sens : leurs marges, leur dette et
            leur croissance n'obéissent pas aux mêmes règles. La plupart des chiffres sont donc comparés aux sociétés du
            <strong className="text-foreground"> même secteur et de la même région</strong> (Europe, États-Unis, Asie).
          </p>
          <p>
            Pour chaque chiffre, on regarde <strong className="text-foreground">la place de l'action dans son secteur</strong>.
            Une société plus rentable que 80 % de ses concurrentes obtient 8 sur 10 pour ce chiffre ; une société moins
            chère que 30 % d'entre elles obtient 3 sur 10 pour son prix. Cette méthode reste fiable même quand la
            moyenne du secteur est proche de zéro ou négative.
          </p>
          <p>
            Quand un secteur compte moins de huit sociétés comparables, le chiffre est noté sur une grille générale.
            La croissance, la dette, le dividende et la tendance du cours sont toujours notés sur des grilles fixes,
            identiques pour tous.
          </p>
        </CardContent>
      </Card>

      {/* Critères */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Les sept critères</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            La note finale est la moyenne des sept critères, pondérée par les pourcentages ci-dessous. Sur la fiche
            de chaque action, chaque critère est expliqué avec les chiffres de l'entreprise.
          </p>
          <div className="space-y-4">
            {PILLARS.map((p) => (
              <div key={p.key} className="flex gap-3">
                <div className="w-10 text-right font-mono text-xs font-semibold text-primary shrink-0 pt-0.5">
                  {Math.round(p.weight * 100)} %
                </div>
                <div>
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-xs leading-relaxed text-muted-foreground">{p.question}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lecture de la note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lire la note</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note sur 10</TableHead>
                <TableHead>Lettre</TableHead>
                <TableHead>Appréciation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GRADES.map((g) => (
                <TableRow key={g.letter}>
                  <TableCell className="text-xs">{g.range}</TableCell>
                  <TableCell className="font-mono font-semibold text-xs">{g.letter}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            L'appréciation décrit la qualité des chiffres actuels de l'entreprise. Ce n'est pas une recommandation
            d'achat ou de vente : une action bien notée peut baisser, et inversement.
          </p>
        </CardContent>
      </Card>

      <ScoreEvaluationCard />

      {/* Données manquantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quand une donnée manque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed">
            <li>Un chiffre absent n'est pas compté : la note du critère repose sur les seuls chiffres disponibles.</li>
            <li>
              Une entreprise qui ne verse pas de dividende n'est pas pénalisée : le critère Dividende est retiré et
              son poids réparti sur les six autres.
            </li>
            <li>
              Si moins de 80 % des chiffres attendus sont disponibles, la note est rapprochée de 5, d'autant plus qu'il
              en manque. Quelques bons chiffres isolés ne suffisent donc pas à placer une action en tête.
            </li>
            <li>
              L'historique de dividendes est jugé sur des années entières : l'année en cours, pas encore terminée, et
              la plus ancienne, incomplète, sont écartées.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Signaux / badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Les 10 signaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Des étiquettes détectées automatiquement. Elles ne modifient pas la note mais signalent une situation
            particulière, à vérifier avant d'en tirer une conclusion.
          </p>
          <div className="grid gap-2">
            {FLAG_CATALOG.map((flag) => (
              <div
                key={flag.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  flag.type === "positive"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{flag.emoji}</span>
                  <span className="font-medium">{flag.label}</span>
                  <span className={cn(
                    "ml-auto text-[10px] uppercase tracking-wide font-semibold",
                    flag.type === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  )}>
                    {flag.type === "positive" ? "Favorable" : "Vigilance"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{flag.description}</p>
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
            <li>Les données proviennent de Yahoo Finance et peuvent contenir des erreurs ou des retards.</li>
            <li>Les chiffres comptables décrivent le passé : ils ne disent rien d'un changement de direction, d'un procès ou d'un nouveau concurrent.</li>
            <li>Les banques, assureurs et sociétés immobilières ont des règles adaptées (certains chiffres ne s'appliquent pas à eux).</li>
            <li>Une note ne remplace pas la lecture des comptes et de l'actualité de l'entreprise.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
