import { useEffect } from "react"
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME } from "@/lib/site"

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

/**
 * Titre et description de la page courante, pour l'onglet du navigateur et les moteurs de recherche.
 * (Les aperçus des réseaux sociaux, eux, lisent les balises écrites à la compilation par scripts/prerender-meta.ts.)
 */
export function usePageMeta(title?: string | null, description?: string | null) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE
    const desc = description ?? DEFAULT_DESCRIPTION
    document.title = fullTitle
    setMeta('meta[name="description"]', "name", "description", desc)
    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle)
    setMeta('meta[property="og:description"]', "property", "og:description", desc)
  }, [title, description])
}
