import { cn } from "@/lib/utils"
import { getFreshness, freshnessColor } from "@/lib/freshness"

interface FreshnessBadgeProps {
  date: string | null | undefined
  className?: string
}

export function FreshnessBadge({ date, className }: FreshnessBadgeProps) {
  const info = getFreshness(date)
  if (!info) return null

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", freshnessColor(info.level), className)}>
      <span aria-hidden="true">{info.dot}</span>
      <span>{info.label}</span>
    </span>
  )
}
