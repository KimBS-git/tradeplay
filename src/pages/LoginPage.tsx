// =====================================================
// 로그인/회원가입 페이지 (pages/LoginPage.tsx)
// 로그인 성공 시 Supabase DB에서 보유 종목·거래 내역·관심 목록을 로드한다.
// =====================================================

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useStockStore } from '../store/stockStore'
import { useWatchlistStore } from '../store/watchlistStore'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { login, signup, isLoading } = useAuthStore()
  const { initCash, loadUserData } = useStockStore()
  const { loadWatchlist } = useWatchlistStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) { setError('아이디와 비밀번호를 입력해주세요.'); return }
    if (isSignup && !name) { setError('이름을 입력해주세요.'); return }

    if (isSignup) {
      // ── 회원가입 ──────────────────────────────────
      // 가입 성공 → 로컬 상태만 초기화 (DB에는 profiles 삽입까지 완료됨)
      const ok = await signup(username, password, name)
      if (!ok) {
        const msg = useAuthStore.getState().lastAuthError ?? '회원가입에 실패했습니다.'
        setError(msg)
        return
      }
      initCash(10_000_000)  // 신규 계좌 로컬 초기화
      navigate('/')
    } else {
      // ── 로그인 ────────────────────────────────────
      const ok = await login(username, password)
      if (!ok) {
        const msg = useAuthStore.getState().lastAuthError ?? '아이디 또는 비밀번호가 올바르지 않습니다.'
        setError(msg)
        return
      }

      const user = useAuthStore.getState().currentUser
      if (user && !user.isAdmin) {
        // 일반 유저: DB에서 보유 종목·거래 내역·잔액·관심 목록을 가져온다
        await Promise.all([
          loadUserData(user.uid),
          loadWatchlist(user.uid),
        ])
      } else if (user?.isAdmin) {
        // 관리자: 전체 유저 목록 로드
        await useAuthStore.getState().loadAllUsers()
      }

      navigate(user?.isAdmin ? '/admin' : '/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 홈으로 돌아가기 */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈으로 돌아가기
          </Link>
        </div>

        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">TradePlay</h1>
          <p className="text-sm text-gray-500">가상 주식 투자 시뮬레이터</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">{isSignup ? '회원가입' : '로그인'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">아이디</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-60 text-sm"
            >
              {isLoading ? '처리 중...' : isSignup ? '가입하기' : '로그인'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignup(!isSignup); setError('') }}
              className="text-xs text-gray-500 hover:text-blue-600 transition"
            >
              {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          초기 시드머니 1,000만원으로 시작합니다
        </p>
      </div>
    </div>
  )
}
