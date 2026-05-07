// =====================================================
// 뉴스 페이지 (pages/NewsPage.tsx)
// 전체 뉴스 피드를 시간 역순으로 나열하는 페이지.
// newsStore에서 feed를 구독해 합성 뉴스가 추가될 때 자동으로 갱신된다.
//
// 별도 갱신 interval이 없는 이유:
//   뉴스 생성은 App.tsx의 NewsBootstrapAndLiveFeed가 담당하므로
//   이 페이지는 store 구독만으로 충분하다.
// =====================================================

import NewsCard from '../components/NewsCard'
import { useNewsStore } from '../store/newsStore'

export default function NewsPage() {
  // feed는 newsStore에서 직접 구독 — 새 뉴스가 추가되면 자동 리렌더링
  const feed = useNewsStore((s) => s.feed)

  return (
    <div className="space-y-5">
      {/* ── 페이지 헤더 및 안내 문구 ─────────────── */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">금융 뉴스</h1>
        {/* 뉴스-시세 연동 지연 정책을 유저에게 명시적으로 안내한다 */}
        <p className="text-xs text-gray-400 mt-1">
          데모용 합성 뉴스는 약 5분마다 추가됩니다. 게시 시각 기준 30분이 지난 뒤에만 시세(drift·일회 반영)에
          적용됩니다.
        </p>
      </div>

      {/* ── 뉴스 카드 목록 ───────────────────────── */}
      <div className="flex flex-col gap-3">
        {feed.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      {/* 피드가 비어 있을 때 안내 (실제로는 초기 mock 뉴스가 항상 있어 표시되지 않음) */}
      {feed.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">뉴스가 없습니다.</div>
      )}
    </div>
  )
}
