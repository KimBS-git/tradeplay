// =====================================================
// 시장 지수 컴포넌트 (components/MarketIndex.tsx)
// KOSPI, NASDAQ, S&P 500, KOSDAQ 지수를 카드 형태로 표시한다.
//
// 한국 주식 관례에 따라 상승은 빨간색, 하락은 파란색으로 표시한다.
// (미국·유럽은 반대이지만 이 앱은 국내 투자자 기준으로 설계되었다.)
// =====================================================

import { useStockStore } from '../store/stockStore'

export default function MarketIndex() {
  const { marketIndices } = useStockStore()

  return (
    // 모바일 2열, 데스크탑 4열 반응형 그리드
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {marketIndices.map((idx) => {
        const isUp = idx.change >= 0
        const sign = isUp ? '+' : ''  // 양수면 '+' 접두사 추가
        return (
          <div key={idx.name} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            {/* 지수명 */}
            <p className="text-xs text-gray-500 mb-1">{idx.name}</p>
            {/* 현재 지수값 — 천 단위 구분자 적용 */}
            <p className="text-lg font-bold text-gray-900">{idx.value.toLocaleString()}</p>
            {/* 등락폭·등락률 — 상승(빨강)/하락(파랑) 색상 분기 */}
            <p className={`text-xs font-medium ${isUp ? 'text-red-500' : 'text-blue-600'}`}>
              {sign}{idx.change.toFixed(2)} ({sign}{idx.changePercent.toFixed(2)}%)
            </p>
          </div>
        )
      })}
    </div>
  )
}
