/**
 * Pages partageables. Run après `vite build` : npx tsx scripts/prerender-meta.ts
 *
 * Le site est une application chargée par le navigateur : sans cette étape, toutes les adresses
 * renvoient le même fichier HTML, avec le même titre. Les réseaux sociaux et messageries, qui
 * n'exécutent pas le code de la page, affichent alors un aperçu identique et vide pour chaque lien.
 *
 * Ce script écrit, pour chaque adresse utile, une copie de la page d'entrée avec son propre titre,
 * sa description et ses balises d'aperçu, ainsi que le plan du site pour les moteurs de recherche.
 * L'hébergeur sert ces fichiers en priorité ; l'application prend ensuite le relais normalement.
 */
import fs from "node:fs"
import path from "node:path"
import { computeScore } from "../src/lib/scoring.ts"
import { stockMeta } from "../src/lib/stockMeta.ts"
import { GLOSSARY } from "../src/lib/glossary.ts"
import { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "../src/lib/site.ts"
import type { Stock } from "../src/types/stock.ts"

const DIST = path.join(process.cwd(), "dist")
const OG_IMAGE = `${SITE_URL}/og-default.png`

interface PageMeta { route: string; title: string; description: string }

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function truncate(s: string, max = 200): string {
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…"
}

function renderHead(template: string, page: PageMeta): string {
  const title = escapeHtml(page.title)
  const description = escapeHtml(truncate(page.description))
  const url = escapeHtml(`${SITE_URL}${page.route}`)
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ")
  // Les balises de la page d'entrée sont remplacées en bloc, entre deux repères
  return template.replace(/<!-- meta:start -->[\s\S]*?<!-- meta:end -->/, `<!-- meta:start -->\n    ${tags}\n    <!-- meta:end -->`)
}

function main() {
  const templatePath = path.join(DIST, "index.html")
  if (!fs.existsSync(templatePath)) {
    console.error("❌ dist/index.html introuvable : lancer d'abord la compilation (vite build)")
    process.exit(1)
  }
  const template = fs.readFileSync(templatePath, "utf8")
  if (!template.includes("<!-- meta:start -->")) {
    console.error("❌ Repères « meta:start / meta:end » absents de index.html")
    process.exit(1)
  }

  const stocks = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "stocks.json"), "utf8")).stocks ?? []) as Stock[]

  const pages: PageMeta[] = [
    { route: "/", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
    { route: "/screener", title: `Screener d'actions éligibles au PEA | ${SITE_NAME}`,
      description: `Filtrez ${stocks.length} actions par note, secteur, taille et dividende. Chaque note est expliquée en clair.` },
    { route: "/picks", title: `AlphaPicks : sélections d'actions mensuelles | ${SITE_NAME}`,
      description: "Six sélections d'actions renouvelées chaque mois, avec leur bilan réel face à l'indice." },
    { route: "/methodologie", title: `Comment les notes sont calculées | ${SITE_NAME}`,
      description: "Les sept critères de la note sur 10, la comparaison au secteur, et ce que les notes ont réellement donné depuis leur publication." },
    { route: "/lexique", title: `Lexique de la Bourse pour débutants | ${SITE_NAME}`,
      description: `${GLOSSARY.length} termes de la Bourse expliqués en une phrase, sans jargon : PER, ROE, dividende, PEA, capitalisation…` },
    { route: "/compare", title: `Comparer des actions | ${SITE_NAME}`,
      description: "Comparez plusieurs actions côte à côte : notes, valorisation, rentabilité, dividende et évolution du cours." },
  ]

  for (const stock of stocks) {
    const meta = stockMeta(stock, computeScore(stock, stocks))
    pages.push({ route: `/stock/${stock.ticker}`, title: `${meta.title} | ${SITE_NAME}`, description: meta.description })
  }

  for (const page of pages) {
    const html = renderHead(template, page)
    const file = page.route === "/" ? templatePath : path.join(DIST, page.route.slice(1), "index.html")
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, html)
  }

  const today = new Date().toISOString().slice(0, 10)
  const sitemap = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...pages.map((p) => `  <url><loc>${escapeHtml(SITE_URL + encodeURI(p.route))}</loc><lastmod>${today}</lastmod></url>`),
    `</urlset>`,
  ].join("\n")
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap)
  fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)

  console.log(`✅ ${pages.length} pages avec leur propre titre et aperçu, sitemap.xml et robots.txt écrits dans dist/`)
}

main()
