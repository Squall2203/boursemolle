import { cn } from "@/lib/utils"
import { getGrade } from "@/lib/grades"

export type { GradeInfo } from "@/lib/grades"

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
