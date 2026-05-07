// =====================================================
// 뉴스 카드 컴포넌트 (components/NewsCard.tsx)
// 개별 뉴스 항목을 카드 UI로 렌더링한다.
// NewsPage와 HomePage의 최신 뉴스 섹션, StockDetailPage의 관련 뉴스에서 재사용된다.
// =====================================================

import type { NewsItem } from '../types'

interface Props {
  news: NewsItem
}

// ── 시간 경과 포맷터 ──────────────────────────────
// publishedAt을 현재 시각과 비교해 "N분 전", "N시간 전", "N일 전" 형식으로 반환한다.
// Date 객체를 매번 생성하는 것보다 Date.now()와 timestamp 차이 계산이 빠르다.
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export default function NewsCard({ news }: Props) {
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* 뉴스 제목 */}
          <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{news.title}</p>
          {/* 요약 — 2줄 초과 시 '...'으로 잘림 (line-clamp-2) */}
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{news.summary}</p>
          {/* 출처 · 경과 시간 */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{news.source}</span>
            <span>·</span>
            <span>{timeAgo(news.publishedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
