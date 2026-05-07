// =====================================================
// 거래 모달 컴포넌트 (components/TradeModal.tsx)
// 모바일 환경에서 OrderPanel을 오버레이 팝업 형태로 표시한다.
//
// 모바일(lg 미만)에서는 사이드바 OrderPanel이 숨겨지고
// 하단 고정 "매수/매도" 버튼을 누르면 이 모달이 열린다.
// 데스크탑에서는 사이드바 OrderPanel이 항상 표시되므로 이 모달은 열리지 않는다.
// =====================================================

import type { Stock } from '../types'
import OrderPanel from './OrderPanel'

interface Props {
  stock: Stock
  onClose: () => void
}

export default function TradeModal({ stock, onClose }: Props) {
  return (
    // 배경 딤(dim) 오버레이 — 클릭하면 모달 닫힘
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      {/* 모달 본문 — 클릭 이벤트가 오버레이로 전파되는 것을 차단한다 */}
      <div className="bg-white rounded-2xl w-80 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* OrderPanel을 모달 내부에 삽입 — border·bg를 제거해 모달 스타일에 맞춤 */}
        <OrderPanel stock={stock} onClose={onClose} className="border-0 bg-transparent p-0" />
      </div>
    </div>
  )
}
