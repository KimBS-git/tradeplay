// =====================================================
// 헤더 컴포넌트 (components/Header.tsx)
// 상단 고정 네비게이션 바. 로고·메뉴·검색창·로그인 상태를 표시한다.
// sticky 포지셔닝으로 스크롤해도 항상 화면 상단에 유지된다.
// =====================================================

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// ── 네비게이션 메뉴 목록 ─────────────────────────
// 라벨과 경로를 배열로 선언해 메뉴 추가·삭제 시 JSX를 수정하지 않아도 된다.
const NAV_ITEMS = [
  { label: '홈', path: '/' },
  { label: '내계좌', path: '/account' },
  { label: '관심', path: '/watchlist' },
  { label: '뉴스', path: '/news' },
]

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()
  const [query, setQuery] = useState('')

  // ── 검색 핸들러 ───────────────────────────────
  // 검색어를 URL 쿼리 파라미터로 인코딩해 /search 페이지로 이동한다.
  // encodeURIComponent를 사용해 한글·특수문자가 URL에 안전하게 포함되게 한다.
  // logout은 async이지만 onClick에서 await 없이 호출해도 된다.
  // 로그아웃 후 navigate가 없고 상태 초기화만 하면 되기 때문이다.
  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setQuery('')  // 이동 후 검색창 초기화
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

        {/* ── 로고 + 네비게이션 ───────────────────── */}
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-blue-600 tracking-tight">
            TradePlay
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              // 홈('/')은 정확히 일치할 때만, 나머지는 경로로 시작할 때 활성화
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                  {/* 활성 탭 하단 인디케이터 바 */}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* ── 검색창 + 프로필 영역 ────────────────── */}
        <div className="flex items-center gap-3">
          {/* 인라인 검색 폼 — 엔터 또는 아이콘 클릭으로 제출 */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 또는 코드 검색"
              className="w-56 pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {/* 돋보기 아이콘 (SVG 인라인) */}
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          </form>

          {/* ── 로그인 상태별 UI ────────────────────
              로그인 중: 이름 + 로그아웃 버튼 (관리자면 관리자 배지 추가)
              미로그인: 로그인 버튼 */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {currentUser.isAdmin ? (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                    관리자
                  </span>
                  {currentUser.displayName}
                </Link>
              ) : (
                <span className="text-sm text-gray-600">{currentUser.displayName}</span>
              )}
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
