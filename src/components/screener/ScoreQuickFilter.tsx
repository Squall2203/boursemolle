import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ScoreQuickFilterProps {
  value: number
  onChange: (min: number) => void
}

const OPTIONS = [
  { label: "Tous scores", value: 0 },
  { label: "Score ≥ 5.0", value: 5 },
  { label: "Score ≥ 6.0", value: 6 },
  { label: "Score ≥ 7.0", value: 7 },
  { label: "Score ≥ 8.0", value: 8 },
  { label: "Score ≥ 9.0", value: 9 },
]

export function ScoreQuickFilter({ value, onChange }: ScoreQuickFilterProps) {
  const current = OPTIONS.find((o) => o.value === value) ? String(value) : "0"

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
