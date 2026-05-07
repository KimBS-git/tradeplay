// =====================================================
// 뉴스 시세 드리프트 유틸리티 (lib/newsDrift.ts)
// 뉴스가 주가에 영향을 주는 시점과 크기를 계산하는 순수 함수 모음.
//
// '지연 반영' 설계 이유:
//   현실에서 뉴스가 나온 직후 주가가 즉시 반응하기도 하지만,
//   시장이 충분히 해석한 뒤에 반영되는 경우도 많다.
//   10분 지연을 두어 "뉴스를 보고 미리 판단"하는 재미를 유저에게 준다.
// =====================================================

import type { NewsItem } from '../types'

// ── 반영 지연 시간 ────────────────────────────────
// 뉴스가 게시된 후 이 시간이 지나야 시세에 반영된다 (10분).
export const NEWS_PRICE_EFFECT_DELAY_MS = 10 * 60 * 1000

// ── 뉴스 반영 여부 판별 ───────────────────────────
// 현재 시각(now) 기준으로 해당 뉴스가 이미 10분이 지났는지 확인한다.
// now 파라미터에 기본값을 두어 테스트 시 임의 시각을 주입할 수 있다.
export function isNewsActiveForPrice(item: NewsItem, now = Date.now()): boolean {
  const published = new Date(item.publishedAt).getTime()
  return now - published >= NEWS_PRICE_EFFECT_DELAY_MS
}

