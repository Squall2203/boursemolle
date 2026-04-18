import { useState } from "react"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePortfolio } from "@/contexts/PortfolioContext"

interface CreatePortfolioCardProps {
  onCreated?: () => void
}

export function CreatePortfolioCard({ onCreated }: CreatePortfolioCardProps) {
  const { createPortfolio, portfolios } = usePortfolio()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    await createPortfolio(name.trim() || "Mon Paper PEA")
    setLoading(false)
    onCreated?.()
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <TrendingUp className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">
          {portfolios.length === 0 ? "Créez votre premier Paper PEA" : "Nouveau Paper PEA"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Investissez virtuellement avec 100 000 € de capital fictif. Même base
          pour tous — seule la stratégie fait la différence.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pea-name">Nom du portefeuille</Label>
          <Input
            id="pea-name"
            placeholder="Mon Paper PEA"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={loading}>
          {loading ? "Création..." : "Créer avec 100 000 €"}
        </Button>
      </div>
    </div>
  )
}
