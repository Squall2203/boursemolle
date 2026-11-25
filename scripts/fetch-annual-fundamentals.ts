/**
 * Comptes annuels des cinq derniers exercices, pour toutes les actions du site.
 * Run: npx tsx scripts/fetch-annual-fundamentals.ts
 *
 * L'ingestion quotidienne ne garde que les chiffres du jour. Ce fichier conserve les comptes de chaque
 * exercice, ce qui permet de recalculer la note qu'une action aurait eue à une date passée
 * (voir scripts/evaluate-score-history.ts). Il n'est pas servi par le site.
 */
import fs from "node:fs"
import path from "node:path"
import YahooFinance from "yahoo-finance2"
import { UNIVERSE } from "./universe.ts"

const OUT_PATH = path.join(process.cwd(), "scripts", "data", "annual-fundamentals.json")
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Un exercice comptable. Montants dans la devise des comptes, qui peut différer de la devise de cotation. */
export interface AnnualStatement {
  /** Date de clôture de l'exercice (AAAA-MM-JJ) */
  periodEnd: string
  revenue: number | null
  netIncome: number | null
  operatingIncome: number | null
  ebitda: number | null
  equity: number | null
  totalAssets: number | null
  totalDebt: number | null
  cash: number | null
  shares: number | null
  eps: number | null
  freeCashFlow: number | null
  dividendsPaid: number | null
}

export interface AnnualFundamentalsFile {
  generatedAt: string
  statements: Record<string, AnnualStatement[]>
  /** Devise dans laquelle chaque société publie ses comptes (peut différer de sa devise de cotation) */
  financialCurrency: Record<string, string>
}

type Raw = Record<string, unknown>
const num = (row: Raw, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  return null
}

async function fetchStatements(ticker: string): Promise<AnnualStatement[]> {
  const rows = (await (yahooFinance as unknown as {
    fundamentalsTimeSeries: (t: string, o: object, m: object) => Promise<Raw[]>
  }).fundamentalsTimeSeries(ticker, { period1: "2015-01-01", type: "annual", module: "all" }, { validateResult: false }))

  return rows
    .filter((r) => r.date instanceof Date)
    .map((r) => ({
      periodEnd: (r.date as Date).toISOString().slice(0, 10),
      revenue: num(r, "totalRevenue", "operatingRevenue"),
      netIncome: num(r, "netIncomeCommonStockholders", "netIncome"),
      operatingIncome: num(r, "operatingIncome", "EBIT"),
      ebitda: num(r, "EBITDA", "normalizedEBITDA"),
      equity: num(r, "stockholdersEquity", "commonStockEquity"),
      totalAssets: num(r, "totalAssets"),
      totalDebt: num(r, "totalDebt"),
      cash: num(r, "cashCashEquivalentsAndShortTermInvestments", "cashAndCashEquivalents"),
      shares: num(r, "ordinarySharesNumber", "shareIssued"),
      eps: num(r, "dilutedEPS", "basicEPS"),
      freeCashFlow: num(r, "freeCashFlow"),
      dividendsPaid: num(r, "cashDividendsPaid", "commonStockDividendPaid"),
    }))
    // Un exercice sans aucun chiffre utile n'apporte rien
    .filter((s) => s.revenue != null || s.netIncome != null || s.equity != null)
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
}

async function fetchFinancialCurrency(ticker: string): Promise<string | null> {
  const summary = await yahooFinance.quoteSummary(ticker, { modules: ["financialData"] })
  return summary.financialData?.financialCurrency ?? null
}

/** Les comptes annuels changent peu : inutile de tout retélécharger si le fichier est récent. */
const MAX_AGE_DAYS = 25

async function main() {
  if (process.argv.includes("--if-stale") && fs.existsSync(OUT_PATH)) {
    const ageDays = (Date.now() - Date.parse(JSON.parse(fs.readFileSync(OUT_PATH, "utf8")).generatedAt)) / 86_400_000
    if (ageDays < MAX_AGE_DAYS) {
      console.log(`Comptes annuels datés de ${ageDays.toFixed(0)} jours : pas de nouveau téléchargement.`)
      return
    }
  }
  const statements: Record<string, AnnualStatement[]> = {}
  const financialCurrency: Record<string, string> = {}
  let ok = 0, empty = 0, failed = 0
  console.log(`Fetching annual statements for ${UNIVERSE.length} tickers...`)
  for (const { ticker } of UNIVERSE) {
    try {
      const s = await fetchStatements(ticker)
      if (s.length > 0) {
        statements[ticker] = s
        ok++
        const currency = await fetchFinancialCurrency(ticker).catch(() => null)
        if (currency) financialCurrency[ticker] = currency
      } else empty++
    } catch {
      failed++
    }
    if ((ok + empty + failed) % 100 === 0) console.log(`  ${ok + empty + failed}/${UNIVERSE.length} (${ok} avec comptes)`)
    await sleep(120)
  }
  console.log(`\n${ok} actions avec comptes, ${empty} sans, ${failed} en échec`)
  // Si la source est indisponible, on garde le fichier précédent plutôt que de l'écraser par un fichier vide
  if (ok < UNIVERSE.length / 2) {
    console.error("❌ Trop peu de comptes récupérés : fichier non réécrit")
    process.exit(1)
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  const file: AnnualFundamentalsFile = { generatedAt: new Date().toISOString(), statements, financialCurrency }
  fs.writeFileSync(OUT_PATH, JSON.stringify(file))
  console.log(`✅ ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} Ko)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
