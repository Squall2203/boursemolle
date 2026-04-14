export type ContentType = "analyse_action" | "macro" | "education" | "portefeuille"
export type Platform = "youtube" | "blog" | "rss"
export type Tier = 1 | 2 | 3

export interface ContentSource {
  id: string
  name: string
  platform: Platform
  tier: Tier
  focus: string
  feedUrl: string
  avatarInitials: string
}

export interface FeedItem {
  id: string
  sourceId: string
  sourceName: string
  platform: Platform
  tier: Tier
  title: string
  description: string
  url: string
  publishedAt: string         // ISO date string
  thumbnailUrl?: string
  tickers: string[]           // e.g. ["MC.PA", "AI.PA"]
  sectors: string[]
  contentType: ContentType
}

export interface FeedData {
  generatedAt: string
  items: FeedItem[]
}
