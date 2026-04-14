import { cn } from "@/lib/utils"

export interface GradeInfo {
  letter: string
  color: string       // text class
  bg: string           // background class
  label: string
}

export function getGrade(score: number): GradeInfo {
  if (score >= 9.0) return { letter: "A+", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-600 dark:bg-emerald-500", label: "Excellent" }
  if (score >= 8.0) return { letter: "A",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500 dark:bg-emerald-500", label: "Tres bon" }
  if (score >= 7.0) return { letter: "B+", color: "text-green-600 dark:text-green-400",     bg: "bg-green-500 dark:bg-green-500",     label: "Bon" }
  if (score >= 6.0) return { letter: "B",  color: "text-slate-600 dark:text-slate-300",     bg: "bg-slate-500 dark:bg-slate-400",     label: "Correct" }
  if (score >= 5.0) return { letter: "C",  color: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-500 dark:bg-orange-400",   label: "Moyen" }
  if (score >= 4.0) return { letter: "D",  color: "text-orange-700 dark:text-orange-300",   bg: "bg-orange-600 dark:bg-orange-500",   label: "Faible" }
  return               { letter: "F",  color: "text-red-600 dark:text-red-400",         bg: "bg-red-600 dark:bg-red-500",         label: "A eviter" }
}

interface LetterGradeProps {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

const SIZES = {
  sm: { circle: "size-8 text-sm",  label: "text-[10px]" },
  md: { circle: "size-12 text-xl", label: "text-xs" },
  lg: { circle: "size-16 text-3xl", label: "text-sm" },
}

export function LetterGrade({ score, size = "md", showLabel = false }: LetterGradeProps) {
  const grade = getGrade(score)
  const s = SIZES[size]

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-bold text-white shrink-0",
          grade.bg,
          s.circle,
        )}
      >
        {grade.letter}
      </div>
      {showLabel && (
        <span className={cn("font-medium", grade.color, s.label)}>
          {grade.label}
        </span>
      )}
    </div>
  )
}
