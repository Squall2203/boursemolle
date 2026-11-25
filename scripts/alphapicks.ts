/**
 * AlphaPicks — Monthly scoring pipeline (Phase 0: Rule-Based)
 * Reads public/data/stocks.json → outputs public/data/picks/latest.json
 * Run: npx tsx scripts/alphapicks.ts
 */

import fs from "fs"
import path from "path"
import { toEur, type FxRates } from "../src/lib/fx.ts"
import { computeScore } from "../src/lib/scoring.ts"
import { getStockRegion } from "../src/lib/market.ts"
import { strategyScore } from "../src/lib/strategyScore.ts"
import type { Stock } from "../src/types/stock.ts"

// ─── Types ──────────────────────────────────────────────────────────────────

type StockData = Stock

interface PickPillars {
  valorisation: number
  qualite: number
  croissance: number
  sante: number
  dividende: number
  momentum: number
}

interface StrategyConfig {
  id: string
  name: string
  emoji: string
  market: "FR" | "EU" | "US" | "WORLD"
  marketLabel: string
  description: string
  benchmarkName: string
  benchmarkTicker: string
  size: number
  filter: (s: StockData) => boolean
  weights: PickPillars
}

interface PickHistoryItem {
  ticker: string
  name: string
  entryPrice: number | null
  exitPrice: number | null
  return: number | null
}

interface StrategyHistoryEntry {
  portfolioReturn: number | null
  picks: PickHistoryItem[]
}

interface PicksHistoryPeriod {
  period: string
  generatedAt: string
  evaluatedAt: string
  strategies: Record<string, StrategyHistoryEntry>
}

interface PicksHistory {
  entries: PicksHistoryPeriod[]
}

// ─── Benchmark fetch ──────────────────────────────────────────────────────────

async function fetchBenchmarkPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!r.ok) return null
    const data = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } }
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

// ─── Strategy definitions ────────────────────────────────────────────────────

const EU_COUNTRIES = new Set([
  "France", "Germany", "Netherlands", "Belgium", "Spain", "Italy",
  "Switzerland", "Sweden", "Denmark", "Norway", "Finland", "Austria",
  "Portugal", "Ireland", "Luxembourg",
])

// ─── Taille et liquidité ─────────────────────────────────────────────────────

let FX_RATES: FxRates | null = null

/** Capitalisation en euros (0 si inconnue), pour que les seuils aient le même sens sur toutes les places. */
function capEur(s: StockData): number {
  return s.marketCapEur ?? toEur(s.marketCap, s.currency, FX_RATES) ?? 0
}

/** Montant moyen échangé par séance en dessous duquel une action est écartée des sélections. */
const MIN_DAILY_VALUE_EUR = 250_000
/** Sans mesure de liquidité disponible, seules les grandes capitalisations sont conservées. */
const LARGE_CAP_EUR = 2e9

/** Montant moyen échangé par séance (euros) sur les 60 dernières séances, lu dans l'historique de cours. */
function dailyValueFromPrices(s: StockData, priceDir: string): number | null {
  const p = path.join(priceDir, `${s.ticker}.json`)
  if (!fs.existsSync(p)) return null
  try {
    const candles = (JSON.parse(fs.readFileSync(p, "utf8")).candles ?? []).slice(-60) as { close: number; volume: number }[]
    if (candles.length < 20) return null
    const avg = candles.reduce((sum, c) => sum + c.close * (c.volume ?? 0), 0) / candles.length
    // Londres cote en pence : on repasse en livres avant conversion
    return toEur(s.currency === "GBp" ? avg / 100 : avg, s.currency, FX_RATES)
  } catch {
    return null
  }
}

function isLiquidEnough(s: StockData, priceDir: string): boolean {
  const daily = s.avgDailyValueEur ?? dailyValueFromPrices(s, priceDir)
  if (daily == null) return capEur(s) >= LARGE_CAP_EUR
  return daily >= MIN_DAILY_VALUE_EUR
}

/** Éligible PEA et réellement cotée en Europe (les données antérieures à décembre 2026 ne vérifiaient que le siège). */
function isPea(s: StockData): boolean {
  return s.peaEligible === true && getStockRegion(s) === "eu"
}

const ML_STRATEGY_ID = "tech-us-ml"
const ML_BENCHMARK_TICKER = "^GSPC"

const STRATEGIES: StrategyConfig[] = [
  {
    id: "france-elite",
    name: "Champions France",
    emoji: "🇫🇷",
    market: "FR",
    marketLabel: "France · PEA",
    description: "Les meilleures actions françaises cotées sur Euronext Paris, sélectionnées sur la qualité, la valorisation et la solidité financière",
    benchmarkName: "CAC 40",
    benchmarkTicker: "^FCHI",
    size: 10,
    filter: (s) => s.country === "France" && isPea(s) && s.price != null && capEur(s) > 300e6,
    weights: { qualite: 0.30, valorisation: 0.30, sante: 0.20, croissance: 0.10, dividende: 0.10, momentum: 0 },
  },
  {
    id: "value-pea",
    name: "Value PEA",
    emoji: "💎",
    market: "EU",
    marketLabel: "Europe · PEA",
    description: "Actions sous-évaluées PEA-éligibles de la zone euro, sélectionnées sur la valorisation et la solidité financière",
    benchmarkName: "CAC 40",
    benchmarkTicker: "^FCHI",
    size: 10,
    filter: (s) => isPea(s) && s.price != null && capEur(s) > 500e6,
    weights: { valorisation: 0.38, qualite: 0.22, sante: 0.20, dividende: 0.10, croissance: 0.05, momentum: 0.05 },
  },
  {
    id: "qualite-monde",
    name: "Qualité Mondiale",
    emoji: "🌍",
    market: "WORLD",
    marketLabel: "Monde entier",
    description: "Champions de la rentabilité et de la création de valeur, sans frontières géographiques",
    benchmarkName: "MSCI World",
    benchmarkTicker: "CW8.PA",
    size: 12,
    filter: (s) => s.price != null && capEur(s) > 5e9,
    weights: { qualite: 0.38, croissance: 0.25, sante: 0.17, momentum: 0.10, valorisation: 0.10, dividende: 0 },
  },
  {
    id: "dividendes-croissants",
    name: "Dividendes Croissants",
    emoji: "📈",
    market: "EU",
    marketLabel: "Europe",
    description: "Rendement élevé et historique de progression régulière du dividende, bilans solides",
    benchmarkName: "Euro Stoxx 50",
    benchmarkTicker: "^STOXX50E",
    size: 10,
    // Stratégie présentée comme européenne : l'univers est restreint à l'Europe (il ne l'était pas)
    filter: (s) => EU_COUNTRIES.has(s.country) && (s.dividendYield ?? 0) >= 2.5 && s.price != null && capEur(s) > 1e9,
    weights: { dividende: 0.40, sante: 0.25, qualite: 0.20, valorisation: 0.15, croissance: 0, momentum: 0 },
  },
  {
    id: "momentum-europe",
    name: "Momentum Europe",
    emoji: "⚡",
    market: "EU",
    marketLabel: "Europe",
    description: "Tendances haussières solides sur les marchés européens, confirmées par les fondamentaux",
    benchmarkName: "Euro Stoxx 50",
    benchmarkTicker: "^STOXX50E",
    size: 10,
    filter: (s) => EU_COUNTRIES.has(s.country) && s.price != null && capEur(s) > 2e9,
    weights: { momentum: 0.45, qualite: 0.25, valorisation: 0.15, croissance: 0.15, sante: 0, dividende: 0 },
  },
  {
    id: "pepites-midcap",
    name: "Pépites Mid Cap",
    emoji: "🔍",
    market: "EU",
    marketLabel: "Europe · Mid Cap",
    description: "Petites et moyennes capitalisations européennes sous-valorisées avec un potentiel de croissance élevé",
    benchmarkName: "MSCI Eur. Small Cap",
    benchmarkTicker: "IQQM.DE",
    size: 10,
    filter: (s) =>
      EU_COUNTRIES.has(s.country) &&
      s.price != null &&
      capEur(s) > 300e6 &&
      capEur(s) < 15e9,
    weights: { valorisation: 0.35, croissance: 0.30, qualite: 0.20, sante: 0.15, dividende: 0, momentum: 0 },
  },
]

// ─── Next update date ────────────────────────────────────────────────────────

/** Prochaine sélection : premier lundi du mois suivant (la tâche planifiée tourne le lundi). */
function nextRebalanceDate(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split("T")[0]
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

// ─── Stratégie ML américaine ─────────────────────────────────────────────────

/**
 * Construit la stratégie ML à partir des prédictions du pipeline Python.
 * Renvoie null si les prédictions ne sont pas celles du mois en cours : un modèle qui n'a pas tourné
 * ne doit pas continuer d'afficher d'anciennes sélections comme si elles étaient à jour.
 */
async function buildMlStrategy(outDir: string, period: string, allStocks: StockData[], prevTickers: string[]) {
  const usPredPath = path.join(outDir, "us_predictions.json")
  if (!fs.existsSync(usPredPath)) {
    console.log(`\n🤖 US ML Strategy — pas de prédictions (lancer scripts/ml/pipeline.py --predict)`)
    return null
  }
  try {
    const usPred = JSON.parse(fs.readFileSync(usPredPath, "utf8"))
    const mlPicks = (usPred.picks ?? []) as Array<{
      ticker: string; name: string; sector: string | null; country: string
      currency: string; rank: number; score: number; pillars: PickPillars
      weight: number; isNew: boolean; pe: number | null; roe: number | null
      perf6M: number | null; divYield: number | null; marketCap: number | null
      price: number | null; peaEligible: boolean; justification: string
    }>

    if (usPred.period !== period) {
      console.log(`\n🤖 US ML Strategy — prédictions périmées (${usPred.period ?? "date inconnue"}, attendu ${period}) : stratégie non publiée`)
      return null
    }
    if (usPred.validated !== true) {
      const reasons = (usPred.backtest?.failed_criteria ?? ["aucune évaluation disponible"]).join(" ; ")
      console.log(`\n🤖 US ML Strategy — modèle non validé par son évaluation sur le passé, stratégie non publiée (${reasons})`)
      return null
    }
    if (mlPicks.length === 0) return null

    const currentPrices = new Map(allStocks.map((s) => [s.ticker, s.price]))
    const picks = mlPicks.map((p) => ({
      ...p,
      // Prix d'entrée = cours du jour de publication, pas celui du jour de la prédiction
      price: currentPrices.get(p.ticker) ?? p.price,
      isNew: !prevTickers.includes(p.ticker) && prevTickers.length > 0,
    }))
    const exits = prevTickers.filter((t) => !mlPicks.some((p) => p.ticker === t))
    const benchmarkPrice = await fetchBenchmarkPrice(ML_BENCHMARK_TICKER)

    console.log(`\n🤖 US ML Strategy — ${picks.length} picks (${usPred.engine ?? "lightgbm"})`)
    console.log(`  Top 3: ${picks.slice(0, 3).map((p) => `${p.ticker} (${p.score.toFixed(1)})`).join(", ")}`)

    return {
      id: ML_STRATEGY_ID,
      name: "US Growth ML",
      emoji: "🤖",
      market: "US" as const,
      marketLabel: "États-Unis",
      description: "Sélection par un modèle statistique entraîné sur les comptes publiés par les sociétés américaines (SEC EDGAR) et sur l'évolution de leurs cours",
      engine: "ml" as const,
      predictionsPeriod: usPred.period as string,
      benchmarkName: "S&P 500",
      benchmarkTicker: ML_BENCHMARK_TICKER,
      benchmarkPrice,
      size: picks.length,
      picks,
      exits,
    }
  } catch (e) {
    console.warn(`  ⚠️  us_predictions.json invalide: ${e}`)
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const stocksPath = path.join(process.cwd(), "public", "data", "stocks.json")
  const outDir = path.join(process.cwd(), "public", "data", "picks")
  const outPath = path.join(outDir, "latest.json")

  if (!fs.existsSync(stocksPath)) {
    console.error("❌ public/data/stocks.json introuvable — lance d'abord l'ingest")
    process.exit(1)
  }

  const dataset = JSON.parse(fs.readFileSync(stocksPath, "utf8"))
  const allStocks: StockData[] = dataset.stocks
  FX_RATES = dataset.fxRates ?? null
  const priceDir = path.join(process.cwd(), "public", "data", "prices")
  const force = process.argv.includes("--force")

  console.log(`📊 Univers : ${allStocks.length} actions`)

  // Previous picks for entry/exit detection + performance tracking
  const previousPicks: Record<string, string[]> = {}
  let previousDataset: { period: string; generatedAt: string; strategies: { id: string; benchmarkPrice?: number | null; picks: { ticker: string; name: string; price: number | null }[] }[] } | null = null

  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8"))
      previousDataset = prev
      for (const s of prev.strategies ?? []) {
        previousPicks[s.id] = (s.picks ?? []).map((p: { ticker: string }) => p.ticker)
      }
    } catch { /* ignore */ }
  }

  // Performance computation — runs when a new month starts
  const period = currentPeriod()

  // Les sélections sont figées pour le mois : on ne les recalcule pas en cours de mois, sinon le
  // prix d'entrée est réécrit chaque semaine et le bilan mensuel ne mesure plus que la dernière semaine.
  if (previousDataset && previousDataset.period === period && !force) {
    console.log(`\n🔒 Sélections de ${period} déjà figées (générées le ${previousDataset.generatedAt.slice(0, 10)}). Utiliser --force pour recalculer.`)

    // Seule exception : la stratégie ML, si ses prédictions du mois sont arrivées après la génération.
    // Elle est alors ajoutée telle quelle, avec le cours du jour comme prix d'entrée ; les autres ne bougent pas.
    const frozen = JSON.parse(fs.readFileSync(outPath, "utf8"))
    const isCurrentMl = (s: { id: string; predictionsPeriod?: string }) =>
      s.id === ML_STRATEGY_ID && s.predictionsPeriod === period
    if (!frozen.strategies.some(isCurrentMl)) {
      const mlStrategy = await buildMlStrategy(outDir, period, allStocks, [])
      if (mlStrategy) {
        // Remplace une éventuelle ancienne version, fondée sur des prédictions d'un autre mois
        frozen.strategies = frozen.strategies.filter((s: { id: string }) => s.id !== ML_STRATEGY_ID)
        frozen.strategies.push(mlStrategy)
        fs.writeFileSync(outPath, JSON.stringify(frozen, null, 2))
        console.log("  ✅ Stratégie ML ajoutée aux sélections du mois")
      }
    }
    return
  }
  if (previousDataset && previousDataset.period && previousDataset.period !== period) {
    console.log(`\n📈 Calcul des performances pour la période ${previousDataset.period}...`)

    const priceMap = new Map<string, number>()
    for (const s of allStocks) {
      if (s.price != null) priceMap.set(s.ticker, s.price)
    }

    const strategyResults: Record<string, StrategyHistoryEntry> = {}
    for (const prevStrat of previousDataset.strategies) {
      const picks: PickHistoryItem[] = []
      let totalReturn = 0
      let count = 0

      for (const pick of prevStrat.picks) {
        const exitPrice = priceMap.get(pick.ticker) ?? null
        const ret =
          exitPrice != null && pick.price != null
            ? Math.round(((exitPrice - pick.price) / pick.price) * 10000) / 100
            : null
        picks.push({ ticker: pick.ticker, name: pick.name, entryPrice: pick.price, exitPrice, return: ret })
        if (ret != null) { totalReturn += ret; count++ }
      }

      strategyResults[prevStrat.id] = {
        portfolioReturn: count > 0 ? Math.round((totalReturn / count) * 100) / 100 : null,
        picks,
      }
    }

    const histPath = path.join(outDir, "history.json")
    let history: PicksHistory = { entries: [] }
    if (fs.existsSync(histPath)) {
      try { history = JSON.parse(fs.readFileSync(histPath, "utf8")) } catch { /* ignore */ }
    }

    // Fetch current benchmark prices for return computation
    const benchmarkTickerMap = new Map<string, string>()
    for (const strat of STRATEGIES) {
      benchmarkTickerMap.set(strat.id, strat.benchmarkTicker)
    }
    benchmarkTickerMap.set(ML_STRATEGY_ID, ML_BENCHMARK_TICKER)

    for (const [id, entry] of Object.entries(strategyResults)) {
      const bmTicker = benchmarkTickerMap.get(id)
      if (!bmTicker) continue

      const prevStrat = previousDataset.strategies.find((s) => s.id === id)
      const bmEntryPrice = prevStrat?.benchmarkPrice ?? null
      const bmExitPrice = await fetchBenchmarkPrice(bmTicker)

      const bmReturn =
        bmEntryPrice != null && bmExitPrice != null
          ? Math.round(((bmExitPrice - bmEntryPrice) / bmEntryPrice) * 10000) / 100
          : null
      const alpha =
        entry.portfolioReturn != null && bmReturn != null
          ? Math.round((entry.portfolioReturn - bmReturn) * 100) / 100
          : null

      entry.benchmarkReturn = bmReturn
      entry.alpha = alpha

      if (bmReturn != null) {
        const sign = bmReturn >= 0 ? "+" : ""
        console.log(`  ${id} benchmark: ${sign}${bmReturn.toFixed(2)}% | alpha: ${alpha != null ? (alpha >= 0 ? "+" : "") + alpha.toFixed(2) + "%" : "n/a"}`)
      }
    }

    history.entries = history.entries.filter((e) => e.period !== previousDataset!.period)
    history.entries.unshift({
      period: previousDataset.period,
      generatedAt: previousDataset.generatedAt,
      evaluatedAt: new Date().toISOString(),
      strategies: strategyResults,
    })

    fs.writeFileSync(histPath, JSON.stringify(history, null, 2))
    console.log("  ✅ history.json mis à jour")
    for (const [id, data] of Object.entries(strategyResults)) {
      if (data.portfolioReturn != null) {
        const sign = data.portfolioReturn >= 0 ? "+" : ""
        console.log(`  ${id}: ${sign}${data.portfolioReturn.toFixed(2)}%`)
      }
    }
  }

  const results = []

  for (const strat of STRATEGIES) {
    const eligible = allStocks.filter(strat.filter)
    const candidates = eligible.filter((s) => isLiquidEnough(s, priceDir))
    console.log(`\n🎯 ${strat.name} — ${candidates.length} candidats (${eligible.length - candidates.length} écartés pour liquidité insuffisante)`)

    // Mêmes notes que sur la fiche de chaque action, pondérées selon l'objectif de la stratégie.
    // Les actions dont trop de critères sont sans donnée ne sont pas classées.
    const scored = candidates.flatMap((s) => {
      const result = strategyScore(computeScore(s, allStocks), strat.weights)
      return result ? [{ s, ...result }] : []
    })

    scored.sort((a, b) => b.score - a.score)
    const topN = scored.slice(0, strat.size)

    const prevTickers = previousPicks[strat.id] ?? []
    const currentTickers = topN.map(({ s }) => s.ticker)
    const exits = prevTickers.filter((t) => !currentTickers.includes(t))

    const weight = Math.round((1 / topN.length) * 1000) / 1000

    const picks = topN.map(({ s, pillars, score, globalScore, justification }, i) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      country: s.country,
      currency: s.currency,
      rank: i + 1,
      score,
      globalScore,
      pillars,
      weight,
      isNew: !prevTickers.includes(s.ticker) && prevTickers.length > 0,
      pe: s.trailingPE,
      roe: s.returnOnEquity,
      perf6M: s.perf6M,
      divYield: s.dividendYield,
      marketCap: s.marketCap,
      marketCapEur: capEur(s) || null,
      price: s.price,
      peaEligible: s.peaEligible,
      justification,
    }))

    console.log(`  Top 3: ${picks.slice(0, 3).map(p => `${p.ticker} (${p.score.toFixed(1)})`).join(", ")}`)

    const benchmarkPrice = await fetchBenchmarkPrice(strat.benchmarkTicker)
    if (benchmarkPrice != null) {
      console.log(`  Benchmark ${strat.benchmarkTicker}: ${benchmarkPrice.toFixed(2)}`)
    }

    results.push({
      id: strat.id,
      name: strat.name,
      emoji: strat.emoji,
      market: strat.market,
      marketLabel: strat.marketLabel,
      description: strat.description,
      engine: "rule_based" as const,
      benchmarkName: strat.benchmarkName,
      benchmarkTicker: strat.benchmarkTicker,
      benchmarkPrice,
      size: strat.size,
      picks,
      exits,
    })
  }

  // ─── US ML strategy — merge predictions from Python pipeline ──────────────
  const mlStrategy = await buildMlStrategy(outDir, period, allStocks, previousPicks[ML_STRATEGY_ID] ?? [])
  if (mlStrategy) results.push(mlStrategy)

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const output = {
    generatedAt: new Date().toISOString(),
    period,
    nextUpdate: nextRebalanceDate(),
    strategies: results,
  }

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ ${outPath}`)
  console.log(`   ${results.length} stratégies · ${results.reduce((s, r) => s + r.picks.length, 0)} sélections au total`)
}

main().catch((e) => { console.error(e); process.exit(1) })
