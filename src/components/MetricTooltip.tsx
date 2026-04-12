import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const METRIC_TOOLTIPS: Record<string, string> = {
  // Fondamentaux
  "P/E (TTM)":
    "Prix / Bénéfice net (12 derniers mois). Un P/E bas peut indiquer une sous-évaluation. Typiquement 10-25 pour les grandes caps EU.",
  "P/E forward":
    "P/E sur les bénéfices estimés de l'année prochaine. Plus fiable si l'entreprise est en croissance ou en déclin.",
  "EV/EBITDA":
    "Valeur d'entreprise / EBITDA. Mesure la valorisation indépendamment de la structure financière. < 10 = potentiellement sous-évalué.",
  "P/B":
    "Prix / Valeur comptable. Utile pour banques et immobilier. < 1 = l'action vaut moins que ses actifs nets.",
  "ROE (%)":
    "Rentabilité des capitaux propres. Mesure l'efficacité de l'argent des actionnaires. > 15% = excellent.",
  "ROA (%)":
    "Rentabilité des actifs totaux. Moins biaisé par l'endettement que le ROE. > 5% = bon pour la plupart des secteurs.",
  "Marge nette (%)":
    "Bénéfice net / CA. Ce qui reste après toutes les charges. Varie selon le secteur (luxe > 15%, distribution < 3%).",
  "Marge opérationnelle (%)":
    "Résultat opérationnel / CA. Rentabilité du cœur de métier, hors éléments financiers et fiscaux.",
  "Croissance CA (YoY)":
    "Croissance du chiffre d'affaires vs l'année précédente. > 10% = croissance soutenue.",
  "Croissance BPA (YoY)":
    "Croissance du bénéfice par action vs l'année précédente. Peut être gonflé par des rachats d'actions.",
  "Dividende (%)":
    "Rendement du dividende = dividende annuel / prix. > 4% = rendement élevé (vérifier la soutenabilité via le payout ratio).",
  "Payout ratio (%)":
    "Part du bénéfice distribuée en dividende. > 80% = peu de marge. < 50% = dividende bien couvert.",
  "Capitalisation (Md€)":
    "Valeur boursière totale de l'entreprise. Les grandes caps (> 10 Md€) sont généralement plus stables.",
  "Valeur d'entreprise":
    "Capitalisation + dette nette. Ce qu'il faudrait payer pour racheter toute l'entreprise.",
  "Dette / Capitaux":
    "Ratio dette / capitaux propres. < 100% = sain. > 200% = attention, sauf secteur financier.",

  // Techniques
  "RSI (14)":
    "Relative Strength Index sur 14 jours. < 30 = survendu (rebond possible). > 70 = suracheté (correction possible).",
  "SMA 20": "Moyenne mobile 20 jours. Tendance court terme.",
  "SMA 50":
    "Moyenne mobile 50 jours. Prix au-dessus = tendance haussière à moyen terme.",
  "SMA 200":
    "Moyenne mobile 200 jours. Prix au-dessus = tendance haussière long terme. Croisement SMA 50 > SMA 200 = Golden Cross.",
  "Perf 1 mois (%)": "Performance du cours sur les 21 derniers jours de bourse.",
  "Perf 6 mois (%)": "Performance du cours sur les 126 derniers jours de bourse.",
  "Perf 1 an (%)": "Performance du cours sur les 252 derniers jours de bourse.",
  "Signal technique":
    "Synthèse des indicateurs techniques (RSI, SMA, volumes). Haussier/Neutre/Baissier avec un % de confiance.",
  Supports:
    "Niveaux de prix où l'action a historiquement rebondi à la hausse. Zones d'achat potentielles.",
  Résistances:
    "Niveaux de prix où l'action a historiquement été repoussée à la baisse. Zones de prise de bénéfice.",
}

interface MetricTooltipProps {
  label: string
}

export function MetricTooltip({ label }: MetricTooltipProps) {
  const text = METRIC_TOOLTIPS[label]
  if (!text) return null

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground/60 hover:text-muted-foreground">
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
