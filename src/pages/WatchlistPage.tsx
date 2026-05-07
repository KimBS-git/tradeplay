// =====================================================
// 관심 종목 페이지 (pages/WatchlistPage.tsx)
// 유저가 관심 등록한 종목만 필터링해 표시한다.
// 비로그인 상태에서는 로그인 유도 화면을 보여준다.
// =====================================================

import { useNavigate } from 'react-router-dom'
import { useWatchlistStore } from '../store/watchlistStore'
import { useStockStore } from '../store/stockStore'
import { useAuthStore } from '../store/authStore'
import StockCard from '../components/StockCard'

export default function WatchlistPage() {
  const { watchlist } = useWatchlistStore()
  const { stocks } = useStockStore()
  const { currentUser: user } = useAuthStore()
  const navigate = useNavigate()

  // watchlist(ID 배열)를 기준으로 실제 종목 데이터를 조회한다
  const watchedStocks = stocks.filter((s) => watchlist.includes(s.id))

  // ── 비로그인 처리 ─────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-gray-500">로그인 후 관심 종목을 저장할 수 있습니다.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
        >
          로그인하기
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 헤더: 페이지 제목 + 등록 건수 ──────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">관심 종목</h1>
        <span className="text-sm text-gray-400">{watchedStocks.length}개</span>
      </div>

      {/* ── 관심 종목 목록 ───────────────────────── */}
      {watchedStocks.length === 0 ? (
        // 관심 종목이 없을 때 빈 상태 안내 + 탐색 유도
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-sm text-gray-400">관심 종목을 추가해보세요</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-blue-600 hover:underline"
          >
            종목 탐색하기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {watchedStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} />
          ))}
        </div>
      )}
    </div>
  )
}
