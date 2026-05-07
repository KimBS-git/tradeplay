import type { NewsItem } from '../types'

interface NaverNewsResponse {
  items: NewsItem[]
}

export async function getKoreanMarketNews(query = '증시'): Promise<NewsItem[]> {
  const res = await fetch(`/api/naver/news?query=${encodeURIComponent(query)}&display=30&sort=date`)
  if (!res.ok) return []
  const data = (await res.json()) as NaverNewsResponse
  return Array.isArray(data?.items) ? data.items : []
}

