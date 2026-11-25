/**
 * Historique quotidien des indices de référence (cinq ans), pour comparer un portefeuille au marché.
 * Appelé par l'ingestion ; peut aussi être lancé seul : npx tsx scripts/benchmarks.ts
 */
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import YahooFinance from "yahoo-finance2"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.resolve(__dirname, "../public/data/benchmarks.json")

const BENCHMARKS = [{ id: "cac40", ticker: "^FCHI", name: "CAC 40" }]

export async function writeBenchmarks(yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })): Promise<void> {
  const start = new Date()
  start.setFullYear(start.getFullYear() - 5)

  const benchmarks: Record<string, { name: string; points: { date: string; close: number }[] }> = {}
  for (const b of BENCHMARKS) {
    try {
      const result = await yahooFinance.chart(b.ticker, { period1: start.toISOString().split("T")[0], interval: "1d" })
      const points = (result.quotes ?? [])
        .filter((q) => q.close != null)
        .map((q) => ({ date: q.date.toISOString().split("T")[0], close: Math.round((q.close as number) * 100) / 100 }))
      if (points.length > 0) benchmarks[b.id] = { name: b.name, points }
      console.log(`  indice ${b.ticker.padEnd(8)} ✓ ${points.length} séances`)
    } catch (err) {
      console.warn(`  indice ${b.ticker}: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Si rien n'a pu être récupéré, on garde le fichier précédent plutôt que de l'écraser par du vide
  if (Object.keys(benchmarks).length === 0) return
  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), benchmarks }), "utf-8")
  console.log(`✓ Wrote ${OUT_PATH}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeBenchmarks().catch((err) => { console.error(err); process.exit(1) })
}
