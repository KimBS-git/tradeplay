// =====================================================
// 관심 종목 버튼 컴포넌트 (components/WatchlistButton.tsx)
// 하트 아이콘 버튼으로 관심 종목 추가·해제를 토글한다.
// StockCard와 StockDetailPage 두 곳에서 재사용된다.
// =====================================================

import { useNavigate } from 'react-router-dom'
import { useWatchlistStore } from '../store/watchlistStore'
import { useAuthStore } from '../store/authStore'

interface Props {
  stockId: string
  size?: 'sm' | 'md'  // StockCard(sm)와 상세 페이지(md) 두 가지 크기 지원
}

export default function WatchlistButton({ stockId, size = 'md' }: Props) {
  const { isWatched, toggle } = useWatchlistStore()
  const { currentUser } = useAuthStore()
  const navigate = useNavigate()
  const watched = isWatched(stockId)

  // ── 클릭 핸들러 ───────────────────────────────
  // e.stopPropagation(): StockCard 전체 클릭(상세 페이지 이동)과 충돌하지 않도록
  //   이벤트 버블링을 차단한다.
  // 비로그인 상태에서는 로그인 페이지로 리다이렉트해 인증을 유도한다.
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!currentUser) {
      navigate('/login')
      return
    }
    toggle(stockId)
  }

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <button
      onClick={handleClick}
      className={`transition-transform hover:scale-110 active:scale-95 ${
        watched ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
      }`}
      title={watched ? '관심 해제' : '관심 추가'}
    >
      {/* 관심 등록 시 fill 속성으로 하트를 채워 시각적으로 구분한다 */}
      <svg className={iconSize} fill={watched ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  )
}
