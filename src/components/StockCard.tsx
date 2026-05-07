// =====================================================
// 주식 카드 컴포넌트 (components/StockCard.tsx)
// 종목 목록에서 개별 종목 한 행을 카드 형태로 표시한다.
// 클릭 시 해당 종목의 상세 페이지로 이동한다.
// =====================================================

import { useNavigate } from 'react-router-dom'
import type { Stock } from '../types'
import WatchlistButton from './WatchlistButton'

// 달러→원화 환산 고정 환율 (실시간 환율 없이 근사값 사용)
const USD_TO_KRW = 1380

interface Props {
  stock: Stock
}

// ── 등락 표시 서브 컴포넌트 ──────────────────────
// 변동액과 변동률을 시장별 포맷으로 렌더링한다.
// KR: "±N원", US: "±$N.NN" 형식으로 표기한다.
function PriceChange({ stock }: { stock: Stock }) {
  const isUp = stock.change >= 0
  const color = isUp ? 'text-red-500' : 'text-blue-600'
  const sign = isUp ? '+' : ''
  const changeStr =
    stock.market === 'KR'
      ? `${sign}${stock.change.toLocaleString()}원`
      : `${sign}$${Math.abs(stock.change).toFixed(2)}`

  return (
    <span className={`text-xs font-medium ${color}`}>
      {changeStr} ({sign}{stock.changePercent.toFixed(2)}%)
    </span>
  )
}

export default function StockCard({ stock }: Props) {
  const navigate = useNavigate()

  // ── 가격 표시 분기 ────────────────────────────
  // 원화와 달러를 같이 표기
  const priceDisplay =
    stock.market === 'KR' ? (
      <p className="text-sm font-bold text-gray-900">{stock.price.toLocaleString()}원</p>
    ) : (
      <div>
        <p className="text-sm font-bold text-gray-900">
          {Math.round(stock.price * USD_TO_KRW).toLocaleString()}원
        </p>
        <p className="text-xs text-gray-400">${stock.price.toFixed(2)}</p>
      </div>
    )

  return (
    // 카드 전체 클릭 → 상세 페이지 이동
    <div
      onClick={() => navigate(`/stock/${stock.id}`)}
      className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all"
    >
      {/* ── 좌측: 종목 아이콘 + 이름·코드 ────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* 종목 코드 앞 2자리를 아이콘 대용으로 표시 */}
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-blue-600">
            {stock.code.slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{stock.name}</p>
          <p className="text-xs text-gray-400">{stock.code} · {stock.market}</p>
        </div>
      </div>

      {/* ── 우측: 가격 + 등락 + 관심 버튼 ─────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          {priceDisplay}
          <PriceChange stock={stock} />
        </div>
        {/* 이벤트 버블링 차단은 WatchlistButton 내부에서 처리 */}
        <WatchlistButton stockId={stock.id} size="sm" />
      </div>
    </div>
  )
}
