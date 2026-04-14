/**
 * ingest-feed.ts — Agrège les contenus YouTube + RSS des influenceurs bourse FR
 * Usage: pnpm tsx scripts/ingest-feed.ts
 * Env: YOUTUBE_API_KEY (optionnel, utilisé si défini)
 *
 * Génère:
 *   public/data/feed.json           — feed global (200 derniers items)
 *   public/data/feed/<ticker>.json  — feed par ticker (20 derniers items)
 */

import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { UNIVERSE } from "./universe.ts"
import type { ContentSource, FeedItem, FeedData, ContentType, Platform } from "../src/types/feed.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FEED_DIR = path.resolve(__dirname, "../public/data/feed")
const FEED_PATH = path.resolve(__dirname, "../public/data/feed.json")
const SOURCES_PATH = path.resolve(__dirname, "../public/data/content_sources.json")

// ─── Sources ──────────────────────────────────────────────────────────────────
// Pour récupérer l'ID d'une chaîne YouTube: ouvrir la chaîne, faire clic droit → "Voir la source",
// chercher "channelId". Ou utiliser https://www.streamweasels.com/tools/youtube-channel-id-and-user-id-convertor/
//
// Format RSS YouTube: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID

const SOURCES: ContentSource[] = [
  // ─── Tier 1 — Analyse fondamentale & stock picking ───
  {
    id: "xavier-delmas",
    name: "Xavier Delmas",
    platform: "youtube",
    tier: 1,
    focus: "Analyse fondamentale, valorisation, stock picking FR",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCVnfV-lBSB7JZ7kDPlFuT4w",
    avatarInitials: "XD",
  },
  {
    id: "sinvestir",
    name: "Matthieu Louvet (S'investir)",
    platform: "youtube",
    tier: 1,
    focus: "ETF, PEA, gestion passive, stock picking",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCFj8TWnRFX-Xhz1YoGN6VKQ",
    avatarInitials: "ML",
  },
  {
    id: "sinvestir-blog",
    name: "S'investir (blog)",
    platform: "blog",
    tier: 1,
    focus: "ETF, PEA, gestion passive",
    feedUrl: "https://www.sinvestir.fr/feed/",
    avatarInitials: "SI",
  },
  {
    id: "etre-riche",
    name: "Etre Riche et Indépendant",
    platform: "blog",
    tier: 1,
    focus: "Screener PEA, score, qualité",
    feedUrl: "https://www.etrericheetindependant.com/feed/",
    avatarInitials: "ER",
  },
  {
    id: "zonebourse",
    name: "ZoneBourse",
    platform: "youtube",
    tier: 1,
    focus: "Analyses, chroniques, multi-contenu",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBi_EGrQV0MV3uBbNcqU4Gw",
    avatarInitials: "ZB",
  },
  {
    id: "sebastien-koubar",
    name: "Sébastien Koubar",
    platform: "youtube",
    tier: 1,
    focus: "Stock picking, analyses actions EU",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC44kGkIlh3G6hLW7TBXUSkg",
    avatarInitials: "SK",
  },

  // ─── Tier 2 — Macro & éducation ───
  {
    id: "finary",
    name: "Finary (Mounir Laggoune)",
    platform: "youtube",
    tier: 2,
    focus: "Patrimoine, macro, interviews experts",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC0ZTfWH5Fl-T8aIXXIPTGSg",
    avatarInitials: "FN",
  },
  {
    id: "epargnant30",
    name: "Edouard Petit (Épargnant 3.0)",
    platform: "blog",
    tier: 2,
    focus: "ETF, gestion passive, académique",
    feedUrl: "https://www.epargnant30.fr/feed/",
    avatarInitials: "EP",
  },
  {
    id: "andlil",
    name: "Benoist Rousseau (Andlil)",
    platform: "youtube",
    tier: 2,
    focus: "Trading, analyse technique",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGUWJHwVhyI9xJ_3w4mH0IA",
    avatarInitials: "BR",
  },

  // ─── Tier 3 — Macro institutionnel ───
  {
    id: "ecb",
    name: "BCE (Banque Centrale Européenne)",
    platform: "rss",
    tier: 3,
    focus: "Politique monétaire, taux directeurs",
    feedUrl: "https://www.ecb.europa.eu/rss/press.en.rss",
    avatarInitials: "BC",
  },
  {
    id: "insee",
    name: "INSEE",
    platform: "rss",
    tier: 3,
    focus: "Données économiques France",
    feedUrl: "https://www.insee.fr/fr/information/rss?theme=all",
    avatarInitials: "IN",
  },
  {
    id: "bfm-bourse",
    name: "BFM Bourse",
    platform: "rss",
    tier: 3,
    focus: "Actualité marchés français",
    feedUrl: "https://bfmbusiness.bfmtv.com/rss/bourse.rss",
    avatarInitials: "BF",
  },
]

// ─── Ticker alias dictionary ───────────────────────────────────────────────────

function buildAliasDict(): Map<string, string> {
  const map = new Map<string, string>()

  for (const entry of UNIVERSE) {
    const name = entry.expectedName.toLowerCase()
    const short = name.split(" ")[0]
    map.set(name, entry.ticker)
    if (short.length >= 4) map.set(short, entry.ticker)
  }

  // Extra manual aliases for common French references
  const extras: Record<string, string> = {
    "lvmh": "MC.PA",
    "louis vuitton": "MC.PA",
    "moët hennessy": "MC.PA",
    "air liquide": "AI.PA",
    "airbus": "AIR.PA",
    "total": "TTE.PA",
    "totalenergies": "TTE.PA",
    "hermès": "RMS.PA",
    "hermes": "RMS.PA",
    "bnp": "BNP.PA",
    "bnp paribas": "BNP.PA",
    "sanofi": "SAN.PA",
    "schneider": "SU.PA",
    "schneider electric": "SU.PA",
    "asml": "ASML.AS",
    "kering": "KER.PA",
    "capgemini": "CAP.PA",
    "danone": "BN.PA",
    "axa": "CS.PA",
    "renault": "RNO.PA",
    "stellantis": "STLAM.MI",
    "michelin": "ML.PA",
    "legrand": "LR.PA",
    "engie": "ENGI.PA",
    "vinci": "DG.PA",
    "edf": "EDF.PA",
    "peugeot": "STLAM.MI",
    "accor": "AC.PA",
    "carrefour": "CA.PA",
    "l'oréal": "OR.PA",
    "loreal": "OR.PA",
    "l'oreal": "OR.PA",
    "safran": "SAF.PA",
    "thales": "HO.PA",
    "dassault": "DSY.PA",
    "société générale": "GLE.PA",
    "credit agricole": "ACA.PA",
    "crédit agricole": "ACA.PA",
    "worldline": "WLN.PA",
    "stmicroelectronics": "STM.PA",
    "stmicro": "STM.PA",
    "eurofins": "ERF.PA",
    "bouygues": "EN.PA",
    "orange": "ORA.PA",
    "ubisoft": "UBI.PA",
    "alstom": "ALO.PA",
    "saint-gobain": "SGO.PA",
    "saint gobain": "SGO.PA",
    "essilor": "EL.PA",
    "essilor luxottica": "EL.PA",
    "essilux": "EL.PA",
    "publicis": "PUB.PA",
    "teleperformance": "TEP.PA",
    "unibail": "URW.AS",
    "unibail rodamco": "URW.AS",
    "vallourec": "VK.PA",
    "eramet": "ERA.PA",
    "arkema": "AKE.PA",
    "ipsen": "IPN.PA",
    "sopra steria": "SOP.PA",
    "soitec": "SOI.PA",
    "rubis": "RUI.PA",
    "tf1": "TFI.PA",
    "m6": "MMT.PA",
    "bayer": "BAYN.DE",
    "volkswagen": "VOW3.DE",
    "siemens": "SIE.DE",
    "basf": "BAS.DE",
    "mercedes": "MBG.DE",
    "bmw": "BMW.DE",
    "allianz": "ALV.DE",
    "continental": "CON.DE",
    "rheinmetall": "RHM.DE",
    "sap": "SAP.DE",
    "adidas": "ADS.DE",
    "infineon": "IFX.DE",
    "ferrari": "RACE.MI",
    "unicredit": "UCG.MI",
    "eni": "ENI.MI",
    "enel": "ENEL.MI",
    "intesa": "ISP.MI",
    "adyen": "ADYEN.AS",
    "shell": "SHELL.AS",
    "unilever": "UNA.AS",
    "philips": "PHIA.AS",
    "heineken": "HEIA.AS",
    "ing": "INGA.AS",
    "ab inbev": "ABI.BR",
    "inbev": "ABI.BR",
    "argenx": "ARGX.BR",
    "inditex": "ITX.MC",
    "zara": "ITX.MC",
    "iberdrola": "IBE.MC",
    "santander": "SAN.MC",
    "bbva": "BBVA.MC",
    "telefonica": "TEF.MC",
    "repsol": "REP.MC",
  }

  for (const [alias, ticker] of Object.entries(extras)) {
    map.set(alias, ticker)
  }

  return map
}

// ─── Ticker extraction ─────────────────────────────────────────────────────────

const TICKER_REGEX = /\b[A-Z]{1,5}\.(PA|AS|BR|DE|LS|MI|HE|VI|L|MC)\b/g
const INDEX_TICKERS: Record<string, string[]> = {
  "cac 40": ["AC.PA", "AI.PA", "AIR.PA", "BNP.PA", "MC.PA", "OR.PA", "SAN.PA", "SU.PA", "TTE.PA"],
  "cac40": ["AC.PA", "AI.PA", "AIR.PA", "BNP.PA", "MC.PA", "OR.PA", "SAN.PA", "SU.PA", "TTE.PA"],
  "dax": ["SAP.DE", "SIE.DE", "ALV.DE", "BMW.DE", "BAYN.DE"],
  "dax 40": ["SAP.DE", "SIE.DE", "ALV.DE", "BMW.DE", "BAYN.DE"],
  "aex": ["ASML.AS", "ADYEN.AS", "SHELL.AS", "UNA.AS"],
}

function extractTickers(text: string, aliasDict: Map<string, string>): string[] {
  const found = new Set<string>()
  const lower = text.toLowerCase()

  // 1. Direct ticker regex (MC.PA, AI.PA, ASML.AS, etc.)
  const directMatches = text.match(TICKER_REGEX) || []
  directMatches.forEach((t) => found.add(t))

  // 2. Name / alias matching (word boundary aware)
  for (const [alias, ticker] of aliasDict.entries()) {
    if (alias.length < 4) continue
    if (lower.includes(alias)) found.add(ticker)
  }

  // 3. Index mentions → list of top tickers (just tag, not individual stocks)
  for (const [index, tickers] of Object.entries(INDEX_TICKERS)) {
    if (lower.includes(index)) tickers.forEach((t) => found.add(t))
  }

  return Array.from(found)
}

// ─── Content type classification ──────────────────────────────────────────────

const MACRO_KEYWORDS = ["taux", "inflation", "bce", "fed", "pib", "croissance économique", "récession", "banque centrale", "politique monétaire", "obli", "spread", "eur/usd", "macro"]
const PORTFOLIO_KEYWORDS = ["portefeuille", "allocation", "diversification", "patrimoine", "pea", "assurance vie", "retraite"]
const EDUCATION_KEYWORDS = ["comment", "guide", "tutoriel", "apprendre", "débutant", "investir", "stratégie", "méthode", "etf", "indice", "gestion passive"]

function classifyContent(title: string, description: string, tickers: string[]): ContentType {
  const text = `${title} ${description}`.toLowerCase()
  if (tickers.length >= 2) return "analyse_action"
  if (MACRO_KEYWORDS.some((k) => text.includes(k))) return "macro"
  if (PORTFOLIO_KEYWORDS.some((k) => text.includes(k))) return "portefeuille"
  if (EDUCATION_KEYWORDS.some((k) => text.includes(k))) return "education"
  if (tickers.length === 1) return "analyse_action"
  return "macro"
}

// ─── XML / RSS parsing ────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  ]
  for (const re of patterns) {
    const m = xml.match(re)
    if (m) return m[1].trim()
  }
  return ""
}

function extractAttr(xml: string, attr: string): string {
  const m = xml.match(new RegExp(`${attr}="([^"]*)"`, "i"))
  return m ? m[1].trim() : ""
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
}

interface ParsedItem {
  title: string
  description: string
  url: string
  publishedAt: string
  thumbnailUrl?: string
}

function parseRSSItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = []

  // Atom feed (YouTube)
  if (xml.includes("<entry>")) {
    const entryMatches = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || []
    for (const entry of entryMatches) {
      const title = extractTag(entry, "title") || extractTag(entry, "media:title")
      const url = extractAttr(entry, "href") || extractTag(entry, "yt:videoId")
        ? `https://www.youtube.com/watch?v=${extractTag(entry, "yt:videoId")}`
        : ""
      const description = extractTag(entry, "media:description") || extractTag(entry, "content") || extractTag(entry, "summary")
      const publishedAt = extractTag(entry, "published") || extractTag(entry, "updated")
      const thumbnailUrl = extractAttr(entry.match(/<media:thumbnail[^>]*>/)?.[0] || "", "url")

      if (title && url) {
        items.push({ title, description: stripTags(description), url, publishedAt, thumbnailUrl })
      }
    }
  }

  // RSS feed
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
  for (const item of itemMatches) {
    const title = extractTag(item, "title")
    const url = extractTag(item, "link") || extractTag(item, "guid")
    const description = extractTag(item, "description") || extractTag(item, "content:encoded")
    const publishedAt = extractTag(item, "pubDate") || extractTag(item, "dc:date")
    const thumbnailUrl = extractAttr(item.match(/<enclosure[^>]*>/)?.[0] || "", "url") ||
      extractAttr(item.match(/<media:content[^>]*>/)?.[0] || "", "url")

    if (title && url) {
      items.push({ title, description: stripTags(description), url, publishedAt, thumbnailUrl })
    }
  }

  return items
}

// ─── YouTube Data API v3 (si clé disponible) ─────────────────────────────────

const YT_API_KEY = process.env.YOUTUBE_API_KEY

async function fetchYouTubeViaAPI(channelId: string, maxResults = 5): Promise<ParsedItem[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${YT_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as { items?: Array<{ id: { videoId: string }; snippet: { title: string; description: string; publishedAt: string; thumbnails: { medium?: { url: string } } } }> }

  return (data.items || []).map((item) => ({
    title: item.snippet.title,
    description: stripTags(item.snippet.description || "").slice(0, 300),
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url,
  }))
}

// ─── Fetch a single source ────────────────────────────────────────────────────

async function fetchSource(
  source: ContentSource,
  aliasDict: Map<string, string>,
): Promise<FeedItem[]> {
  try {
    let parsed: ParsedItem[]

    if (source.platform === "youtube" && YT_API_KEY) {
      const channelId = new URL(source.feedUrl).searchParams.get("channel_id") || ""
      parsed = await fetchYouTubeViaAPI(channelId)
    } else {
      const res = await fetch(source.feedUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "BourseMolle/1.0 Feed Aggregator" },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()
      parsed = parseRSSItems(xml)
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90) // 3 months window

    return parsed
      .filter((item) => {
        if (!item.publishedAt) return true
        const d = new Date(item.publishedAt)
        return !isNaN(d.getTime()) && d >= cutoff
      })
      .slice(0, 10)
      .map((item) => {
        const tickers = extractTickers(`${item.title} ${item.description}`, aliasDict)
        const contentType = classifyContent(item.title, item.description, tickers)
        return {
          id: `${source.id}-${Buffer.from(item.url).toString("base64").slice(0, 12)}`,
          sourceId: source.id,
          sourceName: source.name,
          platform: source.platform,
          tier: source.tier,
          title: item.title,
          description: item.description,
          url: item.url,
          publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
          thumbnailUrl: item.thumbnailUrl,
          tickers,
          sectors: [],
          contentType,
        } satisfies FeedItem
      })
  } catch (err) {
    console.log(`  ✗ ${source.name}: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔄 Ingestion feed influenceurs + macro...\n")
  await mkdir(FEED_DIR, { recursive: true })

  const aliasDict = buildAliasDict()
  console.log(`  Dictionnaire: ${aliasDict.size} alias chargés\n`)

  // Save sources catalog
  await writeFile(SOURCES_PATH, JSON.stringify(SOURCES, null, 2), "utf-8")

  const allItems: FeedItem[] = []

  for (const source of SOURCES) {
    process.stdout.write(`  ${source.name.padEnd(35)}... `)
    const items = await fetchSource(source, aliasDict)
    allItems.push(...items)
    console.log(`✓ ${items.length} items`)

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500))
  }

  // Sort by date desc, deduplicate by URL
  const seen = new Set<string>()
  const deduped = allItems
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
    .slice(0, 200)

  // Write global feed
  const feedData: FeedData = { generatedAt: new Date().toISOString(), items: deduped }
  await writeFile(FEED_PATH, JSON.stringify(feedData, null, 2), "utf-8")
  console.log(`\n✓ feed.json — ${deduped.length} items`)

  // Write per-ticker feeds
  const byTicker = new Map<string, FeedItem[]>()
  for (const item of deduped) {
    for (const ticker of item.tickers) {
      const existing = byTicker.get(ticker) ?? []
      existing.push(item)
      byTicker.set(ticker, existing)
    }
  }

  let tickerFilesWritten = 0
  for (const [ticker, items] of byTicker.entries()) {
    const safeName = ticker.replace(/[^a-zA-Z0-9._-]/g, "_")
    const tickerFeed: FeedData = {
      generatedAt: feedData.generatedAt,
      items: items.slice(0, 20),
    }
    await writeFile(
      path.join(FEED_DIR, `${safeName}.json`),
      JSON.stringify(tickerFeed, null, 2),
      "utf-8",
    )
    tickerFilesWritten++
  }

  console.log(`✓ ${tickerFilesWritten} fichiers ticker générés`)
  console.log("\n✅ Ingestion terminée.\n")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
