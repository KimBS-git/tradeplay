// =====================================================
// 내 계좌 페이지 (pages/AccountPage.tsx)
// 총 자산·평가손익·수익률·보유 종목·거래 내역을 표시하는 포트폴리오 페이지.
// 비로그인 상태에서는 로그인 유도 화면을 보여준다.
// =====================================================

import { useNavigate } from 'react-router-dom'
import { useStockStore } from '../store/stockStore'
import { useAuthStore } from '../store/authStore'
import { useUsdKrw } from '../hooks/useUsdKrw'

// ── 금액 포맷 헬퍼 ───────────────────────────────
// 양수면 '+' 접두사를 붙이고, 원 단위로 표시한다.
// 손익 표시에서 플러스/마이너스를 명확히 구분하기 위해 사용한다.
function formatKRW(n: number) {
  return (n >= 0 ? '+' : '') + Math.round(n).toLocaleString() + '원'
}

export default function AccountPage() {
  const { currentUser: user } = useAuthStore()
  const { stocks, holdings, transactions, cashBalance } = useStockStore()
  const navigate = useNavigate()
  const { rate: USD_TO_KRW } = useUsdKrw()

  // ── 비로그인 처리 ────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-gray-500">로그인 후 이용할 수 있습니다.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
        >
          로그인하기
        </button>
      </div>
    )
  }

  // ── 자산 요약 계산 (환율 적용, 전액 원화 기준) ───────
  const toKrw = (market: 'KR' | 'US', price: number) =>
    market === 'US' ? price * USD_TO_KRW : price

  // 보유 주식 평가금액 합계 (KRW)
  const totalStockValue = holdings.reduce((sum, h) => {
    const stock = stocks.find((s) => s.id === h.stockId)
    return stock ? sum + toKrw(stock.market, stock.price) * h.quantity : sum
  }, 0)

  // 총 자산 = 보유 현금 + 보유 주식 평가금액
  const totalAsset = cashBalance + totalStockValue

  // 평가손익 = Σ (현재가 − 평균매수가) × 수량 (KRW)
  const totalPnl = holdings.reduce((sum, h) => {
    const stock = stocks.find((s) => s.id === h.stockId)
    if (!stock) return sum
    return sum + (toKrw(stock.market, stock.price) - toKrw(h.market, h.averagePrice)) * h.quantity
  }, 0)

  // 투자 원가 = Σ 평균매수가 × 수량 (KRW) — 보유 종목 기준
  const totalInvested = holdings.reduce((sum, h) => {
    return sum + toKrw(h.market, h.averagePrice) * h.quantity
  }, 0)

  // 수익률 = 평가손익 / 투자 원가 × 100 (보유 종목 없으면 0%)
  const totalPnlRate = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  return (
    <div className="space-y-6">

      {/* ── 자산 요약 카드 ────────────────────────
          그라디언트 배경으로 눈에 잘 띄는 핵심 지표를 상단에 배치한다. */}
      <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <p className="text-sm text-blue-100 mb-1">총 자산</p>
        <p className="text-3xl font-bold mb-3">{Math.round(totalAsset).toLocaleString()}원</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-blue-200">평가손익</p>
            {/* 수익이면 붉은 계열, 손실이면 파란 계열로 구분 */}
            <p className={`text-base font-semibold ${totalPnl >= 0 ? 'text-red-300' : 'text-blue-200'}`}>
              {formatKRW(totalPnl)}
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-200">수익률</p>
            <p className={`text-base font-semibold ${totalPnlRate >= 0 ? 'text-red-300' : 'text-blue-200'}`}>
              {totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-200">보유 현금</p>
            <p className="text-base font-semibold">{Math.round(cashBalance).toLocaleString()}원</p>
          </div>
        </div>
      </div>

      {/* ── 보유 종목 목록 ────────────────────────
          각 행을 클릭하면 해당 종목 상세 페이지로 이동한다.
          손익(pnl)은 현재가 기준으로 실시간 계산된다. */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">보유 종목</h2>
        {holdings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
            보유 종목이 없습니다. 종목을 탐색하고 투자해보세요!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {holdings.map((holding) => {
              const stock = stocks.find((s) => s.id === holding.stockId)
              if (!stock) return null
              const toKrw = (p: number) => stock.market === 'US' ? p * USD_TO_KRW : p
              const avgKrw = toKrw(holding.averagePrice)
              const priceKrw = toKrw(stock.price)
              const valuationKrw = Math.round(priceKrw * holding.quantity)
              const pnl = (priceKrw - avgKrw) * holding.quantity
              const pnlRate = ((priceKrw - avgKrw) / avgKrw) * 100
              const isUp = pnl >= 0
              return (
                <div
                  key={holding.stockId}
                  onClick={() => navigate(`/stock/${holding.stockId}`)}
                  className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:border-blue-200 transition"
                >
                  {/* 좌측: 종목명 + 보유 수량 · 평균 단가 */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{holding.stockName}</p>
                    <p className="text-xs text-gray-400">
                      {holding.quantity}주 · 평균{' '}
                      {Math.round(avgKrw).toLocaleString()}원
                      {holding.market === 'US' && (
                        <span className="ml-1 text-gray-300">(${holding.averagePrice.toFixed(2)})</span>
                      )}
                    </p>
                  </div>
                  {/* 우측: 평가금액 + 손익 */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {valuationKrw.toLocaleString()}원
                    </p>
                    {holding.market === 'US' && (
                      <p className="text-xs text-gray-400">(${(stock.price * holding.quantity).toFixed(2)})</p>
                    )}
                    <p className={`text-xs font-medium ${isUp ? 'text-red-500' : 'text-blue-600'}`}>
                      {isUp ? '+' : ''}{Math.round(pnl).toLocaleString()}원 ({isUp ? '+' : ''}{pnlRate.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 거래 내역 ─────────────────────────────
          최근 20건만 표시해 화면이 지나치게 길어지는 것을 방지한다.
          transactions 배열은 매수·매도 시 최신 항목이 앞에 추가된다. */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">거래 내역</h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
            거래 내역이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.slice(0, 20).map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* 매수/매도 배지 — 빨강/파랑으로 구분 */}
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                    tx.type === 'BUY' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {tx.type === 'BUY' ? '매수' : '매도'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.stockName}</p>
                    <p className="text-xs text-gray-400">{tx.quantity}주</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {Math.round(tx.totalAmount).toLocaleString()}원
                  </p>
                  {/* 체결 시각 — HH:MM 형식 */}
                  <p className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
