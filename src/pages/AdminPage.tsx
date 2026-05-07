// =====================================================
// 관리자 페이지 (pages/AdminPage.tsx)
// 관리자 전용 사용자 관리 화면. 마운트 시 Supabase에서 유저 목록을 불러오고
// 가상머니 충전을 DB에 반영한다.
// =====================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function AdminPage() {
  const { currentUser, users, chargeUser, logout, loadAllUsers } = useAuthStore()
  const navigate = useNavigate()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  // 비관리자 접근 차단
  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">접근 권한이 없습니다.</p>
      </div>
    )
  }

  // ── 마운트 시 유저 목록 로드 ─────────────────────
  // Supabase profiles 테이블에서 일반 유저 목록을 가져온다.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    loadAllUsers()
  }, [loadAllUsers])

  // ── 충전 핸들러 ──────────────────────────────────
  // chargeUser가 async로 변경되어 await로 처리한다.
  const handleCharge = async (uid: string) => {
    const raw = amounts[uid]
    const amount = parseInt(raw?.replace(/,/g, '') || '0')
    if (!amount || amount <= 0) {
      setFeedback((f) => ({ ...f, [uid]: '올바른 금액을 입력하세요.' }))
      return
    }
    await chargeUser(uid, amount)
    setFeedback((f) => ({ ...f, [uid]: `+${amount.toLocaleString()}원 충전 완료!` }))
    setAmounts((a) => ({ ...a, [uid]: '' }))
    setTimeout(() => setFeedback((f) => ({ ...f, [uid]: '' })), 2500)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const normalUsers = users.filter((u) => !u.isAdmin)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* 관리자 전용 헤더 */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-600">TradePlay</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              관리자
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{currentUser.displayName}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">사용자 관리</h1>
        <p className="text-sm text-gray-500 mb-6">가상머니를 충전하거나 사용자 현황을 확인합니다.</p>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">전체 회원 수</p>
            <p className="text-2xl font-bold text-gray-900">{normalUsers.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">총 발행 가상머니</p>
            <p className="text-2xl font-bold text-blue-600">
              {normalUsers.reduce((s, u) => s + u.cashBalance, 0).toLocaleString()}원
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">평균 보유 금액</p>
            <p className="text-2xl font-bold text-gray-900">
              {normalUsers.length
                ? Math.round(
                    normalUsers.reduce((s, u) => s + u.cashBalance, 0) / normalUsers.length
                  ).toLocaleString()
                : 0}원
            </p>
          </div>
        </div>

        {/* 유저 목록 */}
        {normalUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">
            가입한 사용자가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {normalUsers.map((user) => (
              <div key={user.uid} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-blue-600">
                        {user.displayName.slice(0, 1)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                      <p className="text-xs text-gray-400">@{user.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-0.5">현재 잔액</p>
                    <p className="text-lg font-bold text-gray-900">
                      {user.cashBalance.toLocaleString()}원
                    </p>
                  </div>
                </div>

                {/* 충전 입력 */}
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    value={amounts[user.uid] || ''}
                    onChange={(e) =>
                      setAmounts((a) => ({ ...a, [user.uid]: e.target.value }))
                    }
                    placeholder="충전할 금액 입력 (원)"
                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleCharge(user.uid)}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    충전
                  </button>
                </div>

                {/* 빠른 금액 버튼 */}
                <div className="flex gap-2 mt-2">
                  {[100_000, 500_000, 1_000_000, 5_000_000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() =>
                        setAmounts((a) => ({
                          ...a,
                          [user.uid]: String((parseInt(a[user.uid] || '0') || 0) + amt),
                        }))
                      }
                      className="flex-1 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition"
                    >
                      +{(amt / 10000).toFixed(0)}만
                    </button>
                  ))}
                </div>

                {feedback[user.uid] && (
                  <p className={`text-xs mt-2 font-medium ${
                    feedback[user.uid].includes('완료') ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {feedback[user.uid]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
