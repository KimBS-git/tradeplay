// =====================================================
// 뉴스 스토어 (store/newsStore.ts)
// 뉴스 피드 상태를 관리하는 Zustand 스토어.
//
// 변경 이유:
//   기존에는 클라이언트 setInterval로 뉴스를 생성했으나,
//   브라우저를 닫으면 생성이 멈추는 문제가 있었다.
//   Supabase pg_cron이 서버에서 5분마다 뉴스를 insert하고
//   클라이언트는 Realtime으로 수신하도록 변경했다.
//
// 흐름:
//   1. 앱 시작 시 loadFeed()로 DB 최신 120건을 가져온다.
//   2. App.tsx에서 Supabase Realtime 구독 후 INSERT 이벤트를
//      prependItem()으로 피드 앞에 추가하고, stockStore에
//      시세 충격을 예약한다.
// =====================================================

import { create } from 'zustand'
import type { NewsItem } from '../types'
import { mockNews } from '../data/news'
import { supabase } from '../lib/supabaseClient'

// 피드 최대 보관 건수 — 초과 시 오래된 항목을 잘라낸다.
const MAX_FEED = 120

// ── 초기 피드 ────────────────────────────────────
// mock 뉴스를 최신 순으로 정렬해 DB 뉴스가 로드되기 전에도
// 빈 화면이 보이지 않도록 한다.
function initialFeed(): NewsItem[] {
  return [...mockNews].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

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
  /** Supabase DB에서 최신 뉴스를 불러와 피드 앞에 병합한다 */
  loadFeed: () => Promise<void>
  /** 외부(App.tsx Realtime 핸들러)에서 새 뉴스 1건을 피드 앞에 추가한다 */
  prependItem: (item: NewsItem) => void
}

export const useNewsStore = create<NewsStoreState>((set) => ({
  feed: initialFeed(),

  // ── DB 뉴스 로드 ─────────────────────────────────
  // 최신 120건을 published_at 내림차순으로 가져와 mock 뉴스 앞에 삽입한다.
  // 중복 ID는 Set으로 필터링해 mock 뉴스와 DB 뉴스가 겹치지 않게 한다.
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
