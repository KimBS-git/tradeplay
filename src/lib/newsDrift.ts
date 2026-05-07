// =====================================================
// 뉴스 시세 드리프트 유틸리티 (lib/newsDrift.ts)
// 뉴스가 주가에 영향을 주는 시점과 크기를 계산하는 순수 함수 모음.
//
// '지연 반영' 설계 이유:
//   현실에서 뉴스가 나온 직후 주가가 즉시 반응하기도 하지만,
//   시장이 충분히 해석한 뒤에 반영되는 경우도 많다.
//   30분 지연을 두어 "뉴스를 보고 미리 판단"하는 재미를 유저에게 준다.
// =====================================================

import type { NewsItem } from '../types'

// ── 반영 지연 시간 ────────────────────────────────
// 뉴스가 게시된 후 이 시간이 지나야 시세에 반영된다 (30분).
export const NEWS_PRICE_EFFECT_DELAY_MS = 30 * 60 * 1000

// ── 뉴스 반영 여부 판별 ───────────────────────────
// 현재 시각(now) 기준으로 해당 뉴스가 이미 30분이 지났는지 확인한다.
// now 파라미터에 기본값을 두어 테스트 시 임의 시각을 주입할 수 있다.
export function isNewsActiveForPrice(item: NewsItem, now = Date.now()): boolean {
  const published = new Date(item.publishedAt).getTime()
  return now - published >= NEWS_PRICE_EFFECT_DELAY_MS
}

// ── 종목별 누적 드리프트 계산 ─────────────────────
// 뉴스 피드 전체를 순회해 30분이 지난 뉴스의 priceImpact를
// 종목 ID를 키로 합산한 맵을 반환한다.
//
// 반환 예시: { 'kr-005930': 4.3, 'us-NVDA': 5.3 }
//
// updatePrices()에서 이 맵을 조회해 랜덤 변동폭에 뉴스 방향성을 가미한다.
// NEUTRAL 뉴스는 합산에서 제외해 의미 없는 드리프트를 차단한다.
export function accumulateDriftByStock(news: NewsItem[], now = Date.now()): Record<string, number> {
  const m: Record<string, number> = {}
  for (const item of news) {
    if (!isNewsActiveForPrice(item, now)) continue // 아직 30분 미경과
    if (item.sentiment === 'NEUTRAL') continue      // 중립 뉴스는 드리프트 없음
    for (const id of item.relatedStockIds) {
      m[id] = (m[id] ?? 0) + item.priceImpact
    }
  }
  return m
}
