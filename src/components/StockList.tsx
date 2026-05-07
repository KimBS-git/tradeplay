// =====================================================
// 주식 목록 컴포넌트 (components/StockList.tsx)
// StockCard를 세로로 나열하는 단순 래퍼 컴포넌트.
// title prop으로 섹션 헤더를 선택적으로 표시할 수 있다.
//
// 별도 컴포넌트로 분리한 이유:
//   HomePage(상승/하락 TOP5), WatchlistPage, SearchPage 등
//   여러 페이지에서 동일한 목록 레이아웃이 반복되기 때문에
//   중복 코드를 줄이고 일관된 UI를 유지한다.
// =====================================================

import type { Stock } from '../types'
import StockCard from './StockCard'

interface Props {
  stocks: Stock[]
  title?: string  // 선택적 섹션 제목
}

export default function StockList({ stocks, title }: Props) {
  return (
    <div>
      {/* title이 있을 때만 헤더 렌더링 */}
      {title && <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>}
      <div className="flex flex-col gap-2">
        {stocks.map((stock) => (
          <StockCard key={stock.id} stock={stock} />
        ))}
      </div>
    </div>
  )
}
