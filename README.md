# [TradePlay](https://tradeplay-seven.vercel.app/) — 모의 주식 트레이딩 시뮬레이터

실시간 시세 데이터를 기반으로 한국·미국 주식을 가상 매매할 수 있는 풀스택 웹 애플리케이션입니다.

---

## 파일 구조

```
my-app/
├── api/                            # Vercel Serverless Functions (CORS 우회 프록시)
│   ├── kr-prev-closes.js           # Yahoo Finance → 국내 주식 전일 종가 프록시
│   └── naver/
│       └── news.js                 # Naver 검색 API → 뉴스 프록시
│
├── src/
│   ├── components/                 # 재사용 UI 컴포넌트
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   ├── StockCard.tsx           # 개별 종목 카드
│   │   ├── StockList.tsx           # 종목 리스트 래퍼
│   │   ├── MarketIndex.tsx         # 시장 지수(KOSPI/NASDAQ 등) 표시
│   │   ├── NewsCard.tsx
│   │   ├── PriceChart.tsx          # 캔들스틱 차트
│   │   ├── OrderPanel.tsx          # 매수/매도 주문 패널
│   │   ├── TradeModal.tsx          # 모바일 주문 모달
│   │   └── WatchlistButton.tsx
│   │
│   ├── pages/                      # 라우트별 페이지
│   │   ├── HomePage.tsx            # 메인 대시보드 (상승/하락 TOP 5)
│   │   ├── LoginPage.tsx
│   │   ├── AdminPage.tsx           # 관리자 — 사용자 관리 및 가상 머니 충전
│   │   ├── AccountPage.tsx         # 내 계좌 — 보유 종목 및 거래 내역
│   │   ├── WatchlistPage.tsx
│   │   ├── NewsPage.tsx
│   │   ├── StockDetailPage.tsx     # 종목 상세 — 차트, 주문, 뉴스
│   │   └── SearchPage.tsx
│   │
│   ├── store/                      # Zustand 전역 상태
│   │   ├── stockStore.ts           # 종목, 보유 현황, 거래 내역, 시장 지수
│   │   ├── authStore.ts            # 인증 및 유저 관리
│   │   ├── newsStore.ts            # 뉴스 피드 관리
│   │   └── watchlistStore.ts       # 관심 종목 관리
│   │
│   ├── lib/                        # 외부 API 클라이언트 및 유틸리티
│   │   ├── finnhub.ts              # Finnhub API 연동
│   │   ├── naverNews.ts            # Naver 뉴스 API 호출
│   │   ├── newsDrift.ts            # 뉴스 감성 → 주가 반영 로직
│   │   ├── supabaseClient.ts       # Supabase 초기화
│   │   └── fx.ts                   # USD/KRW 환율 조회
│   │
│   ├── hooks/
│   │   └── useUsdKrw.ts            # 환율 커스텀 훅
│   │
│   ├── types/
│   │   └── index.ts                # 전역 TypeScript 타입 정의
│   │
│   ├── data/
│   │   └── stocks.ts               # 초기 30개 종목 시드 데이터 (KR + US)
│   │
│   ├── App.tsx                     # 라우터 및 앱 초기화
│   └── main.tsx
│
├── .env                            # API 키 (Supabase, Finnhub, Naver)
├── vite.config.ts
└── package.json
```

---

## 기술 스택

### Frontend
| 분류 | 라이브러리 / 버전 |
|------|-----------------|
| UI 프레임워크 | React 19.2 |
| 라우팅 | React Router 7.14 |
| 상태 관리 | Zustand 5.0 |
| 언어 | TypeScript 6.0 |
| 스타일링 | Tailwind CSS 4.2 |
| 빌드 도구 | Vite 8.0 |
| HTTP 클라이언트 | Axios 1.16 |

### 차트
| 라이브러리 | 용도 |
|-----------|------|
| lightweight-charts 5.2 | 캔들스틱 차트 (TradingView 오픈소스) |

### Backend / 인프라
| 서비스 | 용도 |
|--------|------|
| Supabase | 인증, PostgreSQL DB, 실시간 구독 |
| Vercel Serverless Functions | CORS 우회 API 프록시 |

---

## 사용 API

### 1. Finnhub API
- **용도**: 미국 주식 실시간 시세, 기업 정보, 글로벌 뉴스
- **사용 엔드포인트**

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /search` | 종목 심볼 검색 |
| `GET /quote` | 실시간 주가 조회 (c: 현재가, pc: 전일 종가) |
| `GET /stock/profile2` | 기업 이름, 국가, 로고 등 프로필 |
| `GET /news?category=general` | 전체 시장 뉴스 피드 |
| `GET /company-news` | 특정 종목 관련 뉴스 (최근 7일) |

- **호출 주기**: 2분마다 미국 주식 전체 일괄 동기화
- **Rate Limit**: 무료 플랜 60 calls/min — 요청 간격 조절로 관리

### 2. Yahoo Finance (비공식)
- **용도**: 국내 주식(KOSPI/KOSDAQ) 전일 종가 및 실시간 시세
- **엔드포인트**: `GET /v7/finance/quote?symbols={ticker}.KS`
- **프록시 경로**: `/api/kr-prev-closes` (Vercel Serverless) — 브라우저 CORS 우회
- **취득 데이터**: `regularMarketPrice`, `regularMarketOpen`, `previousClose`

### 3. Naver 검색 API
- **용도**: 한국어 증시 뉴스 및 종목별 뉴스 (KR 종목 상세 페이지)
- **엔드포인트**: `GET /v1/search/news.json?query=증시`
- **프록시 경로**: `/api/naver/news` (서버 사이드 — API 키 노출 방지)
- **앱 시작 시**: 키워드 `'증시'`로 최신 30건 로드 (Finnhub 일반 뉴스는 앱 시작 시 호출하지 않음)
- **종목 상세 진입 시**: 종목명으로 검색해 관련 뉴스를 피드에 태깅

### 4. Open Exchange Rates
- **용도**: USD/KRW 실시간 환율 (미국 주식 원화 환산 표시)
- **엔드포인트**: `GET /v6/latest/USD`
- **캐싱**: 클라이언트 사이드 1시간 캐싱 (`localStorage`)

---

## 주요 기능 로직

### 3-1. API 데이터 활용 방식

#### 국내 주식 가격 흐름
```
앱 시작
  └─ syncKRBaselines()
       └─ /api/kr-prev-closes  ──→  Yahoo Finance
            ├─ regularMarketPrice  →  현재가(price) 우선 사용
            ├─ regularMarketOpen   →  시장가 없을 때 대체
            └─ previousClose       →  전일 종가 — 등락률 계산 기준

매 2분
  └─ syncKRBaselines() 반복
```

#### 미국 주식 가격 흐름
```
앱 시작 + 매 2분
  └─ syncRealPrices()
       └─ Finnhub /quote (종목별)
            ├─ c  (current price)   →  현재가
            └─ pc (prev close)      →  전일 종가 — 등락률 계산 기준
```

#### 환율 적용
- 미국 주식 카드에서 USD 가격과 함께 KRW 환산가 병행 표시
- `useUsdKrw` 훅이 1시간 캐시된 환율을 제공

#### 뉴스 → 주가 영향 (newsDrift.ts)
```
뉴스 수신 (sentiment: POSITIVE | NEGATIVE | NEUTRAL)
  └─ POSITIVE / NEGATIVE만 적용
       └─ 10분 딜레이 후 해당 종목 price에 반영
            └─ 영향 범위: −10% ~ +10% (priceImpact 필드값 기준)
```

---

### 3-2. 상승 / 하락 종목 TOP 5 구현

**핵심 파일**: `src/pages/HomePage.tsx`

```typescript
// 현재 시장(KR/US) 필터링 후 등락률 기준 정렬
const filtered   = stocks.filter(s => s.market === marketTab)
const topGainers = [...filtered].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5)
const topLosers  = [...filtered].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5)
```

**`changePercent` 계산 방식**:
```
changePercent = (현재가 - 전일종가) / 전일종가 × 100
```
- 전일종가(`previousClose`)는 API 동기화 시 확정값으로 저장
- 2분마다 API 재동기화로 현재가 갱신 → 등락률 실시간 반영

**UI 표현 (StockCard.tsx)**:
- 상승: 빨간색 텍스트, `+N.NN%`
- 하락: 파란색 텍스트, `-N.NN%`
- 국내 종목: `±N원 (±N.NN%)` / 미국 종목: `±$N.NN (±N.NN%)`
- 시장 탭(KR/US)을 전환하면 해당 시장 종목만 필터링하여 재계산

---

### 3-3. Supabase 활용 정보

#### DB 테이블 구성

| 테이블 | 주요 컬럼 | 용도 |
|--------|----------|------|
| `profiles` | `id`, `username`, `cash_balance`, `is_admin` | 유저 프로필, 가상 머니 잔고, 관리자 권한 |
| `holdings` | `user_id`, `stock_id`, `quantity`, `average_price` | 보유 종목 현황 (Upsert 방식) |
| `transactions` | `user_id`, `type(BUY/SELL)`, `quantity`, `price`, `total_amount` | 전체 거래 내역 (Insert-only, 불변) |
| `watchlists` | `user_id`, `stock_id` | 관심 종목 |
| `news` | `title`, `sentiment`, `price_impact`, `related_stock_ids` | 뉴스 캐시 및 주가 영향 데이터 |
| `stocks` | `id`, `name` | 검색·추가된 종목 레지스트리 |

#### 주요 데이터 흐름

**로그인 복원**
```
로그인 성공
  └─ Supabase Auth 세션 복원
       ├─ profiles      → 잔고, 관리자 여부 로드
       ├─ holdings      → 보유 종목 전체 로드
       ├─ transactions  → 최근 200건 거래 내역 로드
       └─ watchlists    → 관심 종목 목록 로드
```

**매수 / 매도**
```
주문 실행
  ├─ 1. Zustand 로컬 상태 즉시 업데이트 (UI 반응성)
  ├─ 2. profiles.cash_balance  → 잔고 차감/증가
  ├─ 3. holdings               → 수량 Upsert (전량 매도 시 Delete)
  └─ 4. transactions           → 거래 기록 Insert
```

**관심 종목**
```
하트 버튼 클릭
  ├─ UI 즉시 반영 (Optimistic Update)
  └─ watchlists  → Insert / Delete 동기화
```

**관리자 기능**
```
AdminPage
  ├─ profiles 전체 조회 (is_admin = true 인 유저만 접근)
  └─ 특정 유저 cash_balance Update (가상 머니 충전)
```

#### Row Level Security (RLS)
- 일반 유저: 자신의 `holdings`, `transactions`, `watchlists`만 Read/Write
- 관리자(`is_admin = true`): 전체 `profiles` 조회 및 잔고 수정 가능

---

## 기타 핵심 기능

### 종목 검색 (SearchPage)
1. **로컬 우선 검색**: 앱에 등록된 30개 종목 즉시 매칭
2. **Finnhub 폴백**: 로컬 결과가 5개 미만이면 Finnhub `/search` 호출하여 글로벌 종목 확장
3. **중복 제거**: 심볼 기준 deduplication 후 통합 결과 표시

### 캔들스틱 차트 (PriceChart)
- `lightweight-charts`(TradingView) 기반 전문 차트 렌더링
- 종목 상세 페이지 진입 시 30초마다 Finnhub 재동기화
- 데스크톱: 차트 + 주문 패널 좌우 배치 / 모바일: 주문 TradeModal 오버레이

### 포트폴리오 계산 (AccountPage)
```
총 자산    = 현금 잔고 + Σ(보유 수량 × 현재 시세 원화 환산)
평가 손익  = Σ(보유 수량 × (현재가 원화 − 평균 매수가 원화))
수익률(%)  = 평가 손익 / 투자 원가 × 100
투자 원가  = Σ(보유 수량 × 평균 매수가 원화)
```
- 미국 주식 현재가·평균단가는 `useUsdKrw` 환율로 원화 환산 후 계산

### 거래 시간 제한 (OrderPanel)
- **국내 주식**: 평일 09:00 ~ 16:00 KST에만 매수·매도 가능 (장 외 시간 버튼 비활성화 + 배너 표시)
- **미국 주식**: 주말(토·일) 거래 불가 — 뉴욕(ET) 기준 요일 판단
- **잔액 초과 방지**: 주문금액(원화 기준)이 잔액 초과 시 버튼 비활성화, `+` 버튼도 최대 수량에서 자동 정지

### 뉴스 피드 정렬 및 관리 (newsStore)
- 모든 뉴스 병합 시 `publishedAt` 내림차순 정렬 — 언어·출처와 무관하게 최신 뉴스가 상단
- 피드 최대 120건 유지 (`MAX_FEED`) — 초과 시 오래된 항목 자동 삭제
- 중복 ID는 Set으로 차단해 같은 기사가 두 번 들어오지 않도록 방지

### 인증 구조
- 이메일 포맷: `{username}@tradeplay.local` (외부 노출 없이 내부 처리)
- 회원가입 시 DB 트리거로 `profiles` 행 자동 생성
- 페이지 새로고침 후에도 Supabase 세션 복원으로 로그인 유지
- 로그아웃 시 `watchlistStore`, `stockStore` 상태 초기화 — 다른 계정 정보가 노출되지 않도록 방지
