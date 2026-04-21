export interface NewsArticle {
  title: string
  url: string
  source: string
  published_at: string
  summary: string
  sentiment: "positif" | "négatif" | "neutre"
  sentiment_score: number
}

export interface TickerNews {
  ticker: string
  last_updated: string
  sentiment_score: number
  sentiment_label: "positif" | "négatif" | "neutre"
  articles: NewsArticle[]
}
