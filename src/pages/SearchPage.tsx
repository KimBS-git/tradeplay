// =====================================================
// 검색 페이지 (pages/SearchPage.tsx)
// 로컬 30개 종목과 Finnhub API 결과를 함께 보여준다.
//
// 검색 흐름:
//   1. 로컬 stocks 배열에서 즉시 필터링 (빠름)
//   2. 로컬 결과가 5개 미만이면 Finnhub API 호출 (실제 종목 검색)
//   3. Finnhub 결과 중 로컬에 이미 있는 종목은 중복 제외
//   4. Finnhub 종목 클릭 시 상세 페이지에서 데이터를 가져와 거래 가능
// =====================================================

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useStockStore } from '../store/stockStore'
import StockList from '../components/StockList'
import { searchSymbols, isLocalStock, symbolToId, type FinnhubSymbol } from '../lib/finnhub'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  const { stocks } = useStockStore()

  const [finnhubResults, setFinnhubResults] = useState<FinnhubSymbol[]>([])
  const [isLoadingFinnhub, setIsLoadingFinnhub] = useState(false)

  // ── 로컬 종목 검색 ────────────────────────────────
  const lower = query.toLowerCase()
  const localResults = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.nameEn.toLowerCase().includes(lower) ||
      s.code.toLowerCase().includes(lower) ||
      s.sector.toLowerCase().includes(lower)
  )
  const krResults = localResults.filter((s) => s.market === 'KR')
  const usResults = localResults.filter((s) => s.market === 'US')

  // ── Finnhub 검색 ─────────────────────────────────
  // 로컬 결과가 5개 미만일 때 Finnhub API를 호출한다.
  // 300ms 디바운스로 입력 중 과도한 API 호출을 방지한다.
  useEffect(() => {
    if (!query.trim() || localResults.length >= 5) {
      setFinnhubResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoadingFinnhub(true)
      const results = await searchSymbols(query)
      // 로컬에 이미 있는 종목은 제외
      setFinnhubResults(results.filter((r) => !isLocalStock(r.symbol, stocks)))
      setIsLoadingFinnhub(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, stocks, localResults.length])

  const hasAnyResult = localResults.length > 0 || finnhubResults.length > 0

  return (
    <div className="space-y-6">
      {/* ── 검색 결과 헤더 ───────────────────────── */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">검색 결과</h1>
        <p className="text-sm text-gray-400 mt-1">
          "{query}" · 로컬 {localResults.length}개
          {finnhubResults.length > 0 && ` + 외부 ${finnhubResults.length}개`}
        </p>
      </div>

      {!hasAnyResult && !isLoadingFinnhub && (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-xs text-gray-400">종목명, 코드, 섹터로 검색해보세요</p>
        </div>
      )}

      {/* ── 로컬 종목 결과 ───────────────────────── */}
      {krResults.length > 0 && (
        <StockList stocks={krResults} title={`국내 주식 (${krResults.length})`} />
      )}
      {usResults.length > 0 && (
        <StockList stocks={usResults} title={`미국 주식 (${usResults.length})`} />
      )}

      {/* ── Finnhub 외부 종목 결과 ──────────────── */}
      {isLoadingFinnhub && (
        <p className="text-sm text-gray-400 text-center py-4">외부 종목 검색 중…</p>
      )}

      {!isLoadingFinnhub && finnhubResults.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">
            외부 종목 ({finnhubResults.length})
          </h2>
          <div className="flex flex-col gap-2">
            {finnhubResults.map((r) => (
              <button
                key={r.symbol}
                onClick={() => {
                  const id = encodeURIComponent(symbolToId(r.symbol))
                  const hint = r.description ? `?hint=${encodeURIComponent(r.description)}` : ''
                  navigate(`/stock/${id}${hint}`)
                }}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-blue-200 hover:shadow-sm transition text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.displaySymbol}
                    <span className="ml-2 text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      {r.symbol.endsWith('.KS') || r.symbol.endsWith('.KQ') ? '국내' : '미국'}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-gray-400">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
