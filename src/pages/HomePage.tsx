// =====================================================
// 홈 페이지 (pages/HomePage.tsx)
// 앱의 메인 대시보드. 시장 지수, 상승/하락 TOP5, 최신 뉴스 3건을 표시한다.
//
// 3초마다 주가를 갱신하는 interval을 이 페이지에서 시작하고,
// 언마운트 시 정리해 불필요한 백그라운드 갱신을 막는다.
// (다른 페이지에서도 동일 패턴을 사용한다.)
// =====================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStockStore } from '../store/stockStore'
import MarketIndex from '../components/MarketIndex'
import StockList from '../components/StockList'
import NewsCard from '../components/NewsCard'
import { useNewsStore } from '../store/newsStore'

// 시장 필터 탭 타입
type MarketTab = 'ALL' | 'KR' | 'US'

const TAB_LABELS: { value: MarketTab; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'KR', label: '🇰🇷 국내' },
  { value: 'US', label: '🇺🇸 미국' },
]

export default function HomePage() {
  const { stocks } = useStockStore()
  const newsFeed = useNewsStore((s) => s.feed)
  const navigate = useNavigate()
  const [marketTab, setMarketTab] = useState<MarketTab>('ALL')

  // ── 종목 필터링 및 TOP5 정렬 ──────────────────
  // 탭에 따라 전체/국내/미국 종목을 걸러낸 뒤 변동률 기준으로 정렬한다.
  const filtered = marketTab === 'ALL' ? stocks : stocks.filter((s) => s.market === marketTab)
  const topGainers = [...filtered].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5)
  const topLosers = [...filtered].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5)

  // 홈에서는 뉴스 피드 최신 3건만 미리보기로 표시한다
  const latestNews = newsFeed.slice(0, 3)

  return (
    <div className="space-y-6">

      {/* ── 시장 현황 (시장 지수 카드) ────────────── */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">시장 현황</h2>
        <MarketIndex />
      </section>

      {/* ── 종목 현황 (상승/하락 TOP5) ─────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">종목 현황</h2>

          {/* 국내·미국·전체 필터 토글 */}
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
            {TAB_LABELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMarketTab(value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  marketTab === value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 모바일 1열 / 데스크탑 2열 그리드 */}
        <div className="grid md:grid-cols-2 gap-6">
          <StockList stocks={topGainers} title="📈 상승 TOP 5" />
          <StockList stocks={topLosers} title="📉 하락 TOP 5" />
        </div>
      </section>

      {/* ── 주요 뉴스 (최신 3건 미리보기) ────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">주요 뉴스</h2>
          <button
            onClick={() => navigate('/news')}
            className="text-xs text-blue-600 hover:underline"
          >
            전체보기
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {latestNews.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>
      </section>
    </div>
  )
}
