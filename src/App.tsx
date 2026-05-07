// =====================================================
// 루트 컴포넌트 (App.tsx)
// 라우팅 구조, 뉴스 피드 초기화, Supabase 세션 복원을 담당한다.
// =====================================================

import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AccountPage from './pages/AccountPage'
import WatchlistPage from './pages/WatchlistPage'
import NewsPage from './pages/NewsPage'
import StockDetailPage from './pages/StockDetailPage'
import SearchPage from './pages/SearchPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import { useStockStore } from './store/stockStore'
import { useNewsStore } from './store/newsStore'
import { useAuthStore } from './store/authStore'
import { useWatchlistStore } from './store/watchlistStore'
import { supabase } from './lib/supabaseClient'
import type { NewsItem } from './types'

const FLUSH_PENDING_NEWS_MS = 10_000

// ── Supabase 세션 복원 컴포넌트 ─────────────────────
// 앱 시작 시 브라우저에 저장된 Supabase 세션이 있으면 자동으로 로그인 상태를 복원한다.
// 새로고침 후에도 로그인 상태가 유지된다.
function SessionRestorer() {
  useEffect(() => {
    ;(async () => {
      await useAuthStore.getState().initialize()
      const user = useAuthStore.getState().currentUser
      if (!user) return

      if (!user.isAdmin) {
        // 일반 유저: DB에서 보유 종목·거래 내역·관심 목록 복원
        await Promise.all([
          useStockStore.getState().loadUserData(user.uid),
          useWatchlistStore.getState().loadWatchlist(user.uid),
        ])
      } else {
        // 관리자: 전체 유저 목록 로드
        await useAuthStore.getState().loadAllUsers()
      }
    })()
  }, [])
  return null
}

// ── 뉴스 부트스트랩 & 리얼타임 수신 컴포넌트 ──────────
// UI를 렌더링하지 않고 Supabase Realtime 구독 부수 효과만 담당한다.
//
// 변경 이유:
//   기존 setInterval(pushLive, 5분)은 브라우저 탭이 열려 있을 때만 동작했다.
//   Supabase pg_cron이 서버에서 5분마다 news 테이블에 insert하고,
//   여기서는 그 INSERT 이벤트를 Realtime으로 수신해 피드와 시세 충격을 반영한다.
function NewsBootstrapAndLiveFeed() {
  useEffect(() => {
    // 앱 시작 시 mock 뉴스 시세 충격을 즉시 예약한다.
    useStockStore.getState().ensureMockNewsImpactsApplied()

    // DB에서 기존 뉴스를 로드한다.
    useNewsStore.getState().loadFeed()

    // Supabase Realtime: news 테이블 INSERT 이벤트 구독
    // pg_cron이 5분마다 generate_news_item()을 호출해 새 행을 삽입하면
    // 이 핸들러가 즉시 실행되어 피드에 추가하고 시세 충격을 예약한다.
    const channel = supabase
      .channel('news-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const item: NewsItem = {
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
          useNewsStore.getState().prependItem(item)
          useStockStore.getState().scheduleDelayedNewsPriceImpact(item)
        }
      )
      .subscribe()

    // 10초마다 만기된 시세 충격을 주가에 반영한다.
    const flushId = window.setInterval(
      () => useStockStore.getState().flushDueNewsPriceImpacts(),
      FLUSH_PENDING_NEWS_MS
    )

    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(flushId)
    }
  }, [])
  return null
}

// ── 라우팅 구조 ──────────────────────────────────────
// /login, /admin은 Layout(헤더) 밖에 두어 독립 레이아웃으로 표시한다.
export default function App() {
  return (
    <BrowserRouter>
      <SessionRestorer />
      <NewsBootstrapAndLiveFeed />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/stock/:id" element={<StockDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
