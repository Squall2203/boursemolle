import { Check, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface MultiSelectFieldProps {
  label: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
}

export function MultiSelectField({
  label,
  options,
  value,
  onChange,
  placeholder = "Tous",
  searchPlaceholder = "Rechercher...",
}: MultiSelectFieldProps) {
  const isActive = value.length > 0

  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} sélectionnés`

  return (
    <div
      className={cn(
        "space-y-2 rounded-md p-2 -mx-2 transition-colors",
        isActive && "bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
          {isActive && (
            <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-primary" />
          )}
        </Label>
        {isActive && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Réinitialiser ce filtre"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-between font-normal",
              isActive && "border-primary/30",
            )}
          >
            <span className={cn(value.length === 0 && "text-muted-foreground")}>
              {summary}
            </span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Aucun résultat.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.includes(option)
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => toggle(option)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex size-4 items-center justify-center rounded-sm border",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </div>
                      {option}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
