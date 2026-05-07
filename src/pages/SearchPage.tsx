// =====================================================
// 검색 페이지 (pages/SearchPage.tsx)
// URL 쿼리 파라미터 ?q=를 읽어 종목을 검색하고 결과를 표시하는 페이지.
//
// URL 파라미터로 검색어를 관리하는 이유:
//   뒤로가기·새로고침 시 검색 상태가 유지되고,
//   특정 검색 결과를 URL로 공유할 수 있다.
// =====================================================

import { useSearchParams } from 'react-router-dom'
import { useStockStore } from '../store/stockStore'
import StockList from '../components/StockList'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { stocks } = useStockStore()

  // ── 종목 검색 로직 ────────────────────────────
  // 한글 종목명·영문명·종목코드·섹터 모두를 소문자 변환 후 부분 일치 검색한다.
  // toLowerCase()를 사용해 대소문자 구분 없이 검색할 수 있게 한다.
  const lower = query.toLowerCase()
  const results = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.nameEn.toLowerCase().includes(lower) ||
      s.code.toLowerCase().includes(lower) ||
      s.sector.toLowerCase().includes(lower)
  )

  // 결과를 국내/미국으로 분리해 구분하여 표시한다
  const krResults = results.filter((s) => s.market === 'KR')
  const usResults = results.filter((s) => s.market === 'US')

  return (
    <div className="space-y-6">
      {/* ── 검색 결과 헤더 ───────────────────────── */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">검색 결과</h1>
        <p className="text-sm text-gray-400 mt-1">
          "{query}" · {results.length}개 종목
        </p>
      </div>

      {/* ── 결과 목록 ────────────────────────────── */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-xs text-gray-400">종목명, 코드, 섹터로 검색해보세요</p>
        </div>
      ) : (
        <>
          {/* 국내·미국 결과가 각각 있을 때만 해당 섹션을 렌더링한다 */}
          {krResults.length > 0 && (
            <StockList stocks={krResults} title={`국내 주식 (${krResults.length})`} />
          )}
          {usResults.length > 0 && (
            <StockList stocks={usResults} title={`미국 주식 (${usResults.length})`} />
          )}
        </>
      )}
    </div>
  )
}
