// =====================================================
// 합성 뉴스 생성기 (lib/generateSyntheticNews.ts)
// 실제 외부 API 없이 뉴스 피드를 자동으로 채우기 위한 랜덤 뉴스 생성 로직.
//
// 설계 이유:
//   데모 환경에서 뉴스 API를 호출하면 CORS 문제나 API 키 관리가 필요하다.
//   미리 작성한 템플릿 문장에 종목명을 조합해 삽입함으로써
//   충분히 자연스러운 금융 뉴스 텍스트를 생성한다.
// =====================================================

import { initialStocks } from '../data/stocks'
import type { NewsItem, Stock } from '../types'

// ── 출처 목록 ─────────────────────────────────────
// 국내외 실제 금융 언론사 이름을 사용해 뉴스의 현실감을 높인다.
const SOURCES = [
  '한국경제',
  '매일경제',
  '연합뉴스',
  '이데일리',
  '조선비즈',
  'Bloomberg',
  'Reuters',
  'CNBC',
  'WSJ',
  '전자신문',
]

// ── 헬퍼 함수 ─────────────────────────────────────

// 배열에서 무작위 요소 하나를 반환한다.
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

// Fisher-Yates 셔플로 배열을 무작위로 섞은 뒤 앞 n개를 반환한다.
// 단순 Math.random() 정렬보다 통계적으로 편향이 없어 균등 분포를 보장한다.
function shufflePick(stocks: readonly Stock[], n: 1 | 2): Stock[] {
  const copy = [...stocks]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = copy[i]!
    const b = copy[j]!
    copy[i] = b
    copy[j] = a
  }
  return copy.slice(0, n)
}

// sentiment에 따라 시세 충격 크기를 계산한다.
// 0.6~3.4% 범위에서 소수점 1자리로 반올림해 현실적인 변동폭을 표현한다.
function impactFor(sentiment: NewsItem['sentiment']): number {
  if (sentiment === 'NEUTRAL') return 0
  const mag = 0.6 + Math.random() * 2.8
  const rounded = Math.round(mag * 10) / 10
  return sentiment === 'POSITIVE' ? rounded : -rounded
}

type Sent = NewsItem['sentiment']

// ── 긍정 뉴스 템플릿 ──────────────────────────────
// title/summary 함수가 종목명(a, b)을 받아 문장을 조합한다.
// b(두 번째 종목)가 있으면 두 종목 관련 문장, 없으면 단일 종목 문장을 반환한다.
const POS_LINES: { title: (a: string, b?: string) => string; summary: (a: string, b?: string) => string }[] = [
  {
    title: (a) => `${a}, 실적 서프라이즈… 매출 성장세 지속`,
    summary: (a) =>
      `${a}가 시장 컨센서스를 웃도는 분기 실적을 기록하며 주가 상승 요인으로 작용하고 있다.`,
  },
  {
    title: (a, b) => (b ? `${a}·${b}, 시너지 기대감에 매수세` : `${a}, 신규 딜 기대감에 강세`),
    summary: (a, b) =>
      b
        ? `${a}와 ${b} 간 협력 가능성이 부각되며 관련주가 동반 강세를 보였다.`
        : `${a}가 대형 계약 체결을 앞두고 있다는 관측이 나오며 관심이 쏠렸다.`,
  },
  {
    title: (a) => `${a}, 해외 수주 확대… 성장 모멘텀 부각`,
    summary: (a) => `${a}가 글로벌 시장에서 수주 잔고를 늘리며 중장기 성장 스토리가 재평가받고 있다.`,
  },
  {
    title: (a) => `${a}, 기관 순매수 유입… 저평가 매력`,
    summary: (a) => `국내외 기관투자자가 ${a}에 대한 매수 우위를 보이며 단기 흐름이 개선됐다.`,
  },
]

// ── 부정 뉴스 템플릿 ──────────────────────────────
const NEG_LINES: { title: (a: string, b?: string) => string; summary: (a: string, b?: string) => string }[] = [
  {
    title: (a) => `${a}, 악재에 발목… 단기 조정 압력`,
    summary: (a) => `${a}를 둘러싼 사업·규제 이슈가 부각되며 투자심리가 위축된 모습이다.`,
  },
  {
    title: (a, b) => (b ? `${a}·${b}, 업황 둔화 우려에 약세` : `${a}, 경쟁 심화에 점유율 하락 우려`),
    summary: (a, b) =>
      b
        ? `${a}와 ${b}가 속한 섹터의 수요 둔화 우려가 확산되며 주가에 부담으로 작용했다.`
        : `${a}가 주력 시장에서 경쟁사에 밀릴 수 있다는 분석이 나왔다.`,
  },
  {
    title: (a) => `${a}, 증권가 목표가 일제히 하향`,
    summary: (a) => `여러 증권사가 ${a}의 목표주가를 낮추며 실적 전망을 보수적으로 조정했다.`,
  },
  {
    title: (a) => `${a}, 원가·금리 부담에 마진 압박`,
    summary: (a) => `${a}의 단기 이익률이 원재료·금융비용 상승으로 압박받을 수 있다는 관측이 나왔다.`,
  },
]

// ── 중립 뉴스 템플릿 ──────────────────────────────
const NEU_LINES: { title: (a: string, b?: string) => string; summary: (a: string, b?: string) => string }[] = [
  {
    title: (a) => `${a}, 임원 인사·조직개편 단행`,
    summary: (a) => `${a}가 경영 효율화를 위해 조직 구조를 조정했다. 시장 반응은 엇갈렸다.`,
  },
  {
    title: (a, b) =>
      b ? `${a}·${b}, 업계 표준 재조명… 관망세` : `${a}, 신사업 일정 공시… 실질 영향은 제한적`,
    summary: (a, b) =>
      b
        ? `${a}와 ${b} 관련 공시가 나왔으나 당장 실적에 미칠 영향은 크지 않다는 평가다.`
        : `${a}가 로드맵을 공유했지만 단기 주가에는 중립적이라는 분석이 많다.`,
  },
]

// ── 감성 비율 롤 ──────────────────────────────────
// POSITIVE 42%, NEGATIVE 42%, NEUTRAL 16% 비율로 생성된다.
// 지나치게 긍정적이거나 부정적으로 치우치지 않도록 균형을 맞췄다.
function rollSentiment(): Sent {
  const r = Math.random()
  if (r < 0.42) return 'POSITIVE'
  if (r < 0.84) return 'NEGATIVE'
  return 'NEUTRAL'
}

// ── 합성 뉴스 아이템 생성 ────────────────────────
// 호출될 때마다 고유한 뉴스 항목을 한 건 반환한다.
// 28% 확률로 두 종목이 연관된 뉴스를 생성해 현실감을 더한다.
export function generateSyntheticNewsItem(): NewsItem {
  const two = Math.random() < 0.28  // 두 종목 관련 뉴스 생성 여부
  const picked = shufflePick(initialStocks, two ? 2 : 1)
  const a = picked[0]!
  const b = picked[1]
  const sentiment = rollSentiment()
  const lines =
    sentiment === 'POSITIVE' ? pick(POS_LINES) : sentiment === 'NEGATIVE' ? pick(NEG_LINES) : pick(NEU_LINES)

  const nameA = a.name
  const nameB = b?.name

  return {
    // Date.now() + 난수 문자열 조합으로 중복 없는 ID를 생성한다.
    id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: lines.title(nameA, nameB),
    summary: lines.summary(nameA, nameB),
    url: '#',
    source: pick(SOURCES),
    relatedStockIds: b ? [a.id, b.id] : [a.id],
    sentiment,
    priceImpact: impactFor(sentiment),
    publishedAt: new Date().toISOString(),
  }
}
