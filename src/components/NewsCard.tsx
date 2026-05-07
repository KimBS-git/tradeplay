// =====================================================
// 뉴스 카드 컴포넌트 (components/NewsCard.tsx)
// 개별 뉴스 항목을 카드 UI로 렌더링한다.
// NewsPage와 HomePage의 최신 뉴스 섹션, StockDetailPage의 관련 뉴스에서 재사용된다.
// url이 실제 링크인 경우 클릭 시 새 탭에서 기사 전문을 열 수 있다.
// =====================================================

import type { NewsItem } from '../types'

interface Props {
  news: NewsItem
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export default function NewsCard({ news }: Props) {
  const hasLink = news.url && news.url !== '#'

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{news.title}</p>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{news.summary}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{news.source}</span>
          <span>·</span>
          <span>{timeAgo(news.publishedAt)}</span>
          {hasLink && (
            <>
              <span>·</span>
              <span className="text-blue-500">기사 전문 →</span>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (hasLink) {
    return (
      <a
        href={news.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm hover:border-blue-100 transition-all"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
      {inner}
    </div>
  )
}
