export interface GradeInfo {
  letter: string
  color: string
  bg: string
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
