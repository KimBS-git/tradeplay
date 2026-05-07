// =====================================================
// 주문 패널 컴포넌트 (components/OrderPanel.tsx)
// 매수·매도 주문을 입력하고 실행하는 UI.
// StockDetailPage(사이드바)와 TradeModal(모바일 팝업) 두 곳에서 재사용된다.
//
// onClose prop이 있을 때만 닫기 버튼을 표시하는 이유:
//   사이드바에서는 닫기가 필요 없고, 모달에서는 필요하므로
//   같은 컴포넌트를 두 컨텍스트 모두에서 쓸 수 있게 한다.
// =====================================================

import { useState } from 'react'
import type { Stock } from '../types'
import { useStockStore } from '../store/stockStore'
import { useAuthStore } from '../store/authStore'

type Tab = 'BUY' | 'SELL'

interface Props {
  stock: Stock
  onClose?: () => void    // 모달 모드일 때만 전달 — 있으면 닫기 버튼 표시
  className?: string
}

export default function OrderPanel({ stock, onClose, className = '' }: Props) {
  const [tab, setTab] = useState<Tab>('BUY')
  const [quantity, setQuantity] = useState(1)
  const [result, setResult] = useState<string | null>(null)  // 주문 결과 메시지
  const { buyStock, sellStock, cashBalance, holdings } = useStockStore()
  const { currentUser } = useAuthStore()

  const holding = holdings.find((h) => h.stockId === stock.id)
  const totalCost = stock.price * quantity

  // 시장별 가격 포맷 함수 — KR: "N원", US: "$N.NN"
  const formatPrice = (p: number) =>
    stock.market === 'KR' ? p.toLocaleString() + '원' : '$' + p.toFixed(2)

  // ── 주문 실행 ────────────────────────────────
  // buyStock/sellStock은 성공 여부를 boolean으로 반환한다.
  // 성공 시 모달 모드에서는 1.2초 후 자동으로 닫는다.
  const handleTrade = () => {
    if (!currentUser) return
    const ok = tab === 'BUY' ? buyStock(stock.id, quantity) : sellStock(stock.id, quantity)
    setResult(ok ? (tab === 'BUY' ? '매수 완료!' : '매도 완료!') : tab === 'BUY' ? '잔액이 부족합니다.' : '보유 수량이 부족합니다.')
    if (ok && onClose) setTimeout(onClose, 1200)
  }

  return (
    <div className={`rounded-2xl border border-gray-100 bg-gray-50/80 p-4 ${className}`}>

      {/* ── 종목명 + 닫기 버튼 ────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900 text-sm">{stock.name}</p>
          <p className="text-xs text-gray-400">{stock.code}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        )}
      </div>

      {/* ── 매수/매도 탭 ──────────────────────────
          한국 주식 UI 관례에 따라 매수는 빨간색, 매도는 파란색으로 표시한다. */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-3">
        {(['BUY', 'SELL'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              setResult(null)  // 탭 전환 시 이전 결과 메시지 초기화
            }}
            className={`flex-1 py-2 text-xs font-semibold transition ${
              tab === t
                ? t === 'BUY'
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-white text-gray-500'
            }`}
          >
            {t === 'BUY' ? '매수' : '매도'}
          </button>
        ))}
      </div>

      {/* ── 현재가 표시 ────────────────────────── */}
      <div className="flex justify-between text-xs mb-2">
        <span className="text-gray-500">현재가</span>
        <span className="font-bold text-gray-900">{formatPrice(stock.price)}</span>
      </div>

      {/* ── 수량 입력 (- / 직접입력 / +) ──────────
          직접 입력 시 최솟값 1을 보장하기 위해 parseInt 후 Math.max를 사용한다. */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 text-sm"
        >
          -
        </button>
        <input
          type="number"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="flex-1 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setQuantity(quantity + 1)}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 text-sm"
        >
          +
        </button>
      </div>

      {/* ── 주문 요약 ─────────────────────────────
          매수 탭: 주문 후 잔액이 부족하면 빨간색으로 경고
          매도 탭: 현재 보유 수량 안내 */}
      <div className="bg-white rounded-lg p-3 mb-3 space-y-1 text-xs border border-gray-100">
        <div className="flex justify-between">
          <span className="text-gray-500">주문 금액</span>
          <span className="font-semibold text-gray-900">{formatPrice(totalCost)}</span>
        </div>
        {tab === 'BUY' && (
          <div className="flex justify-between">
            <span className="text-gray-500">주문 후 잔액</span>
            <span className={totalCost > cashBalance ? 'text-red-500 font-medium' : 'text-gray-900'}>
              {stock.market === 'KR'
                ? (cashBalance - totalCost).toLocaleString() + '원'
                : '$' + (cashBalance - totalCost).toFixed(2)}
            </span>
          </div>
        )}
        {tab === 'SELL' && holding && (
          <div className="flex justify-between">
            <span className="text-gray-500">보유 수량</span>
            <span className="text-gray-900">{holding.quantity}주</span>
          </div>
        )}
      </div>

      {/* ── 결과 메시지 또는 주문 버튼 ───────────────
          주문 결과가 있으면 버튼 대신 결과 메시지를 표시한다.
          비로그인 상태에서는 버튼이 비활성화(disabled)된다. */}
      {result ? (
        <div
          className={`text-center py-2 text-xs font-medium rounded-lg ${
            result.includes('완료') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'
          }`}
        >
          {result}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleTrade}
          disabled={!currentUser}
          className={`w-full py-2.5 rounded-xl font-bold text-white text-xs transition ${
            tab === 'BUY' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {!currentUser ? '로그인 후 거래 가능' : tab === 'BUY' ? `${quantity}주 매수` : `${quantity}주 매도`}
        </button>
      )}
    </div>
  )
}
