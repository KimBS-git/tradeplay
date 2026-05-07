// =====================================================
// 뉴스 스토어 (store/newsStore.ts)
// 뉴스 피드 상태를 관리하는 Zustand 스토어.
//
// 뉴스 출처:
//   - loadKoreanMarketNews: Naver 검색 API에서 한국어 시장 뉴스를 가져온다.
//   - loadMarketNews: Finnhub /news?category=general 에서 글로벌 시장 뉴스를 가져온다.
//   - loadCompanyNews: 종목 상세 페이지에서 Finnhub /company-news로 종목별 뉴스를 가져온다.
//
// 흐름:
//   1. App.tsx 마운트 시 loadMarketNews()로 최신 30건을 가져온다.
//   2. 종목 상세 진입 시 loadCompanyNews(stockId)로 해당 종목 뉴스를 추가한다.
// =====================================================

import { create } from 'zustand'
import type { NewsItem } from '../types'
import { supabase } from '../lib/supabaseClient'
import { getMarketNews, getCompanyNews } from '../lib/finnhub'
import { getKoreanMarketNews } from '../lib/naverNews'

// 피드 최대 보관 건수 — 초과 시 오래된 항목을 잘라낸다.
const MAX_FEED = 120

// ── DB 행 → NewsItem 변환 ──────────────────────────
// Supabase에서 받은 snake_case 행을 camelCase NewsItem으로 매핑한다.
function rowToNewsItem(row: Record<string, unknown>): NewsItem {
  return {
    id: row.id as string,
    title: row.title as string,
    summary: row.summary as string,
    url: '#',
    source: row.source as string,
    relatedStockIds: (row.related_stock_ids as string[]) ?? [],
    sentiment: row.sentiment as NewsItem['sentiment'],
    priceImpact: Number(row.price_impact),
    publishedAt: row.published_at as string,
  }
}

interface NewsStoreState {
  feed: NewsItem[]
  /** Finnhub 시장 전반 뉴스를 가져와 피드 앞에 병합한다 */
  loadMarketNews: () => Promise<void>
  /** Naver(한국어) 뉴스 검색 결과를 가져와 피드 앞에 병합한다 */
  loadKoreanMarketNews: (query?: string) => Promise<void>
  /**
   * 종목 상세 페이지 진입 시 해당 종목의 뉴스를 가져온다.
   * - US: Finnhub /company-news (relatedStockIds 자동 세팅)
   * - KR: Naver API로 종목명 검색 후 relatedStockIds에 stockId 태깅
   */
  loadCompanyNews: (stockId: string, market?: 'KR' | 'US', stockName?: string) => Promise<void>
  /** Supabase DB에서 최신 뉴스를 불러와 피드 앞에 병합한다 (폴백용) */
  loadFeed: () => Promise<void>
  /** App.tsx Realtime 핸들러에서 새 뉴스 1건을 피드 앞에 추가한다 */
  prependItem: (item: NewsItem) => void
}

export const useNewsStore = create<NewsStoreState>((set) => ({
  feed: [],

  // ── Finnhub 시장 뉴스 로드 ───────────────────────
  // 피드에 없는 뉴스만 필터링해 앞에 병합한다. 중복 ID는 Set으로 차단한다.
  loadMarketNews: async () => {
    const items = await getMarketNews()
    if (items.length === 0) return
    set((s) => {
      const existingIds = new Set(s.feed.map((i) => i.id))
      const newItems = items.filter((i) => !existingIds.has(i.id))
      return { feed: [...newItems, ...s.feed].slice(0, MAX_FEED) }
    })
  },

  // ── Naver(한국어) 시장 뉴스 로드 ───────────────────
  loadKoreanMarketNews: async (query = '증시') => {
    const items = await getKoreanMarketNews(query)
    if (items.length === 0) return
    set((s) => {
      const existingIds = new Set(s.feed.map((i) => i.id))
      const newItems = items.filter((i) => !existingIds.has(i.id))
      return { feed: [...newItems, ...s.feed].slice(0, MAX_FEED) }
    })
  },

  // ── 종목별 뉴스 로드 ────────────────────────────
  // US: Finnhub /company-news — relatedStockIds가 자동으로 stockId로 세팅된다.
  // KR: Finnhub은 무료 플랜에서 국내 종목을 지원하지 않으므로
  //     Naver API로 종목명을 검색한 뒤 결과에 stockId를 태깅한다.
  //     이미 피드에 있는 항목은 relatedStockIds만 업데이트하고,
  //     새 항목은 relatedStockIds: [stockId]로 추가한다.
  loadCompanyNews: async (stockId: string, market?: 'KR' | 'US', stockName?: string) => {
    if (market === 'KR' && stockName) {
      const items = await getKoreanMarketNews(stockName)
      if (items.length === 0) return
      set((s) => {
        const resultIds = new Set(items.map((i) => i.id))
        // 이미 피드에 있는 항목: relatedStockIds에 stockId 추가
        const updatedFeed = s.feed.map((item) =>
          resultIds.has(item.id) && !item.relatedStockIds.includes(stockId)
            ? { ...item, relatedStockIds: [...item.relatedStockIds, stockId] }
            : item
        )
        // 피드에 없는 새 항목: stockId 태깅 후 추가
        const existingIds = new Set(updatedFeed.map((f) => f.id))
        const newItems = items
          .filter((i) => !existingIds.has(i.id))
          .map((i) => ({ ...i, relatedStockIds: [stockId] }))
        return { feed: [...newItems, ...updatedFeed].slice(0, MAX_FEED) }
      })
    } else {
      const items = await getCompanyNews(stockId)
      if (items.length === 0) return
      set((s) => {
        const existingIds = new Set(s.feed.map((i) => i.id))
        const newItems = items.filter((i) => !existingIds.has(i.id))
        return { feed: [...newItems, ...s.feed].slice(0, MAX_FEED) }
      })
    }
  },

  // ── DB 뉴스 로드 ─────────────────────────────────
  // 최신 120건을 published_at 내림차순으로 가져와 피드 앞에 병합한다.
  // 중복 ID는 Set으로 필터링해 기존 피드와 겹치지 않게 한다.
  loadFeed: async () => {
    const { data } = await supabase
      .from('news')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(MAX_FEED)

    if (!data || data.length === 0) return

    const dbItems = data.map(rowToNewsItem)

    set((s) => {
      const existingIds = new Set(dbItems.map((i) => i.id))
      const merged = [
        ...dbItems,
        ...s.feed.filter((i) => !existingIds.has(i.id)),
      ].slice(0, MAX_FEED)
      return { feed: merged }
    })
  },

  // ── 실시간 뉴스 추가 ─────────────────────────────
  // App.tsx Realtime 핸들러가 INSERT 이벤트를 받으면 이 메서드를 호출한다.
  // MAX_FEED 초과 시 slice로 잘라 메모리를 일정하게 유지한다.
  prependItem: (item: NewsItem) => {
    set((s) => ({ feed: [item, ...s.feed].slice(0, MAX_FEED) }))
  },
}))
