// =====================================================
// 전역 타입 정의 (types/index.ts)
// 애플리케이션 전체에서 공유되는 TypeScript 인터페이스를 한 곳에 모아 관리한다.
// 타입을 별도 파일로 분리하면 어느 컴포넌트에서든 같은 형태를 보장할 수 있고,
// 변경 시 한 곳만 수정하면 되므로 유지보수가 쉬워진다.
// =====================================================

// ── 주식 종목 ──────────────────────────────────────
// 시뮬레이터에서 거래되는 개별 주식 종목의 구조.
// market 필드를 'KR' | 'US'로 구분해 원화/달러 표기를 분기 처리한다.
export interface Stock {
  id: string           // 고유 식별자 (예: 'kr-005930', 'us-AAPL')
  name: string         // 한글 종목명
  nameEn: string       // 영문 종목명
  code: string         // 증권 코드 (예: '005930', 'AAPL')
  market: 'KR' | 'US' // 국내(코스피·코스닥) vs 미국 시장 구분
  price: number        // 현재가
  prevPrice: number    // 전일 종가 — 등락률 계산의 기준값
  change: number       // 전일 대비 변동액
  changePercent: number // 전일 대비 변동률 (%)
  volume: number       // 거래량
  sector: string       // 섹터 (예: '반도체', 'Technology')
}

// ── 뉴스 아이템 ────────────────────────────────────
// 뉴스 피드에 표시되는 개별 기사 구조.
// sentiment와 priceImpact를 함께 저장해, 뉴스가 주가에 미치는 영향을
// 게시 후 30분이 지난 시점에 자동 반영하는 '지연 반영' 로직에 활용한다.
export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  relatedStockIds: string[]           // 이 뉴스와 연관된 종목 ID 목록
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  priceImpact: number                 // 시세 충격 크기 (예: +2.1 → +2.1%)
  publishedAt: string                 // ISO 8601 날짜 문자열
}

// ── 보유 종목 ──────────────────────────────────────
// 유저가 현재 보유 중인 주식 정보.
// averagePrice는 분할 매수 시 단가를 평균 내어 손익 계산에 사용한다.
export interface Holding {
  stockId: string
  stockName: string
  market: 'KR' | 'US'
  quantity: number
  averagePrice: number // 매수 평균 단가
}

// ── 거래 내역 ──────────────────────────────────────
// 매수·매도가 완료될 때마다 생성되어 거래 이력으로 쌓인다.
// totalAmount를 별도로 저장해 이력 표시 시 재계산 없이 바로 렌더링한다.
export interface Transaction {
  id: string
  stockId: string
  stockName: string
  market: 'KR' | 'US'
  type: 'BUY' | 'SELL'
  quantity: number
  price: number        // 체결 당시 단가
  totalAmount: number  // 체결 총액 (price × quantity)
  createdAt: string    // ISO 8601 체결 시각
}

// ── 시장 지수 ──────────────────────────────────────
// KOSPI, NASDAQ, S&P 500, KOSDAQ 등 주요 시장 지수 정보.
export interface MarketIndex {
  name: string
  value: number
  change: number
  changePercent: number
}

// ── 사용자 ─────────────────────────────────────────
// 로그인한 유저의 공개 프로필.
// password는 RegisteredUser(authStore 내부)에만 존재하고
// 여기서는 노출하지 않아 보안을 강화한다.
export interface User {
  uid: string
  username: string
  displayName: string
  cashBalance: number  // 현금 잔액 (원 단위 통합 관리)
  isAdmin: boolean
}
