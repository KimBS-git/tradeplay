// =====================================================
// 주식 상세 페이지 (pages/StockDetailPage.tsx)
// 개별 종목의 상세 정보, 캔들스틱 차트, 주문 패널, 관련 뉴스를 보여준다.
//
// 반응형 레이아웃 설계:
//   - 데스크탑(lg 이상): 차트와 OrderPanel이 좌우로 나란히 표시된다.
//   - 모바일(lg 미만): OrderPanel을 숨기고 하단 고정 버튼으로 TradeModal을 연다.
//   이렇게 하면 모바일 화면이 좁아도 차트가 충분히 크게 표시된다.
// =====================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// 달러→원화 환산 고정 환율
const USD_TO_KRW = 1380
import { useStockStore } from '../store/stockStore'
import PriceChart from '../components/PriceChart'
import OrderPanel from '../components/OrderPanel'
import WatchlistButton from '../components/WatchlistButton'
import TradeModal from '../components/TradeModal'
import NewsCard from '../components/NewsCard'
import { useNewsStore } from '../store/newsStore'

export default function StockDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { stocks, updatePrices } = useStockStore()
  const newsFeed = useNewsStore((s) => s.feed)
  const [showTradeModal, setShowTradeModal] = useState(false)

  // URL 파라미터 id로 해당 종목을 조회한다
  const stock = stocks.find((s) => s.id === id)

  // 3초마다 주가 갱신 — PriceChart의 currentPrice prop이 바뀌어 차트가 실시간 업데이트된다
  useEffect(() => {
    const interval = setInterval(updatePrices, 3000)
    return () => clearInterval(interval)
  }, [updatePrices])

  // ── 종목 없음 처리 ────────────────────────────
  if (!stock) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-gray-500">종목을 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">
          돌아가기
        </button>
      </div>
    )
  }

  // ── 가격 포맷 헬퍼 ───────────────────────────
  const isUp = stock.change >= 0
  const priceColor = isUp ? 'text-red-500' : 'text-blue-600'
  const sign = isUp ? '+' : ''
  const formatUSD = (p: number) => `$${p.toFixed(2)}`
  const formatKRW = (p: number) => `${Math.round(p).toLocaleString()}원`
  const formatPrice = (p: number) =>
    stock.market === 'KR' ? formatKRW(p) : formatUSD(p)

  // 현재 종목과 연관된 뉴스만 필터링
  const relatedNews = newsFeed.filter((n) => n.relatedStockIds.includes(stock.id))

  return (
    <>
      <div className="space-y-5">

        {/* ── 뒤로가기 ──────────────────────────── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← 뒤로
        </button>

        {/* ── 종목 헤더 + 차트 + 주문 패널 ─────────
            lg 이상에서 차트(flex-1)와 OrderPanel(고정 너비)이 좌우 배치된다. */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-gray-900">{stock.name}</h1>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {stock.market}
                </span>
              </div>
              <p className="text-sm text-gray-400">{stock.nameEn} · {stock.code}</p>
            </div>
            <WatchlistButton stockId={stock.id} size="md" />
          </div>

          {/* 현재가 표시 — 미국 주식은 달러 아래 원화 환산액 추가 표시 */}
          <div className="mb-4">
            <p className="text-3xl font-bold text-gray-900">{formatPrice(stock.price)}</p>
            {stock.market === 'US' && (
              <p className="text-sm text-gray-400 mt-0.5">
                ≈ {formatKRW(stock.price * USD_TO_KRW)}
                <span className="text-xs ml-1">(₩{USD_TO_KRW}/달러 기준)</span>
              </p>
            )}
            <p className={`text-sm font-medium mt-1 ${priceColor}`}>
              {sign}{formatPrice(Math.abs(stock.change))} ({sign}{stock.changePercent.toFixed(2)}%)
            </p>
          </div>

          {/* 반응형 레이아웃: 모바일 세로 / 데스크탑 가로 */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <PriceChart stockId={stock.id} currentPrice={stock.price} market={stock.market} />
            </div>
            {/* 데스크탑에서만 표시되는 사이드바 주문 패널 */}
            <div className="w-full shrink-0 lg:w-72 xl:w-80">
              <OrderPanel stock={stock} />
            </div>
          </div>
        </div>

        {/* ── 종목 기본 정보 ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">종목 정보</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: '섹터', value: stock.sector },
              { label: '시장', value: stock.market === 'KR' ? '코스피' : '나스닥/NYSE' },
              { label: '종목코드', value: stock.code },
              { label: '거래량', value: stock.volume.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 관련 뉴스 ─────────────────────────────
            해당 종목이 relatedStockIds에 포함된 뉴스만 표시한다.
            관련 뉴스가 없으면 섹션 자체를 숨긴다. */}
        {relatedNews.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">관련 뉴스</h2>
            <div className="flex flex-col gap-2">
              {relatedNews.map((news) => (
                <NewsCard key={news.id} news={news} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 모바일 하단 고정 주문 버튼 ──────────────
          lg 이상에서는 lg:hidden으로 숨겨진다.
          클릭하면 TradeModal이 열린다. */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setShowTradeModal(true)}
          className="px-10 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-blue-700 transition"
        >
          매수 / 매도
        </button>
      </div>

      {/* 모바일 주문 모달 — showTradeModal이 true일 때만 렌더링 */}
      {showTradeModal && (
        <TradeModal stock={stock} onClose={() => setShowTradeModal(false)} />
      )}
    </>
  )
}
