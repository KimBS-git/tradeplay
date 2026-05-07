// =====================================================
// 루트 컴포넌트 (App.tsx)
// 라우팅 구조, Supabase 세션 복원, 실시간 주가·뉴스 동기화를 담당한다.
//
// 주요 컴포넌트:
//   - SessionRestorer: 새로고침 후 로그인 상태를 Supabase 세션에서 복원한다.
//   - NewsBootstrapAndLiveFeed: 앱 시작 시 Finnhub 실제 뉴스를 로드하고,
//     2분마다 전체 종목 실시간 가격을 Finnhub /quote로 동기화한다.
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

const REAL_PRICE_SYNC_MS = 2 * 60 * 1000 // 2분마다 실제 가격 동기화

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

// ── 실시간 주가·뉴스 부트스트랩 컴포넌트 ────────────────
// UI를 렌더링하지 않고 초기 데이터 로드와 주기적 동기화 부수 효과만 담당한다.
//
// - loadMarketNews: 앱 시작 시 Finnhub 실제 뉴스를 가져온다.
// - syncRealPrices: 2분마다 Finnhub /quote로 전체 종목 실가를 동기화한다.
function NewsBootstrapAndLiveFeed() {
  useEffect(() => {
    // 시뮬레이션 뉴스 시세 충격은 실제 가격을 사용하므로 적용하지 않는다.
    useStockStore.getState().ensureMockNewsImpactsApplied()

    // 한국어 뉴스는 네이버 뉴스 API(프록시)로 로드한다.
    // (Finnhub 시장 뉴스는 기본 비활성화 — 영문 위주라 UX가 섞일 수 있음)
    useNewsStore.getState().loadKoreanMarketNews('증시')

    // 앱 시작 즉시 한 번 실시간 가격(US/KR)을 동기화하고, 이후 2분마다 반복한다.
    useStockStore.getState().syncKRBaselines() // KR: 하이브리드(현재가 → 시가 → 전일종가)
    useStockStore.getState().syncRealPrices()  // US: Finnhub /quote
    const usSyncId = window.setInterval(
      () => useStockStore.getState().syncRealPrices(),
      REAL_PRICE_SYNC_MS
    )
    const krSyncId = window.setInterval(
      () => useStockStore.getState().syncKRBaselines(),
      REAL_PRICE_SYNC_MS
    )

    return () => {
      window.clearInterval(usSyncId)
      window.clearInterval(krSyncId)
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
