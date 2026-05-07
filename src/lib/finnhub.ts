// =====================================================
// Finnhub API 클라이언트 (lib/finnhub.ts)
// 실제 종목 검색과 회사 정보·현재가를 가져온다.
// 무료 tier: 분당 60회 호출 가능.
//
// 설계:
//   - searchSymbols: 헤더 검색창 입력 시 종목명·코드 검색
//   - getStockDetail: 검색 결과 클릭 시 회사 정보와 현재가를 한 번에 가져온다
//   - 가져온 데이터는 stockStore에 추가되어 이후 로컬 상태로 거래에 활용된다
// =====================================================

import type { Stock } from '../types'

const KEY = import.meta.env.VITE_FINNHUB_API_KEY as string
const BASE = 'https://finnhub.io/api/v1'

// ── 검색 결과 타입 ──────────────────────────────────
export interface FinnhubSymbol {
  description: string   // 회사명 (영문)
  displaySymbol: string // 표시용 심볼 (예: AAPL, 005930.KS)
  symbol: string        // API 호출용 심볼
  type: string          // "Common Stock" | "ETP" 등
}

// ── Finnhub 심볼 → 로컬 종목 ID 변환 ─────────────────
// KOSPI(.KS) / KOSDAQ(.KQ) 여부에 따라 시장을 구분한다.
// 접두사 'fh-'를 붙여 로컬 하드코딩 종목(kr-, us-)과 충돌을 방지한다.
export function symbolToId(symbol: string): string {
  return `fh-${symbol}`
}

// ── 로컬 stocks 배열에 이미 있는 종목인지 확인 ──────────
// Finnhub 결과와 중복 표시되지 않도록 거른다.
export function isLocalStock(symbol: string, localStocks: Stock[]): boolean {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
    const code = symbol.replace(/\.(KS|KQ)$/, '')
    return localStocks.some((s) => s.market === 'KR' && s.code === code)
  }
  return localStocks.some((s) => s.market === 'US' && s.code === symbol)
}

// ── 심볼에서 시장·코드 파싱 ───────────────────────────
function parseSymbol(symbol: string): { market: 'KR' | 'US'; code: string } {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
    return { market: 'KR', code: symbol.replace(/\.(KS|KQ)$/, '') }
  }
  return { market: 'US', code: symbol }
}

// ── 종목 검색 ────────────────────────────────────────
// Common Stock 타입만 반환해 ETF·워런트 등을 제외한다.
export async function searchSymbols(query: string): Promise<FinnhubSymbol[]> {
  if (!KEY || !query.trim()) return []
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&token=${KEY}`)
    const data = await res.json()
    return ((data.result ?? []) as FinnhubSymbol[]).filter(
      (r) => r.type === 'Common Stock'
    )
  } catch {
    return []
  }
}

// ── 회사 정보 + 현재가 조회 ──────────────────────────
// profile2와 quote를 병렬로 호출해 응답 시간을 줄인다.
// 가격이 0이거나 회사명이 없으면 null 반환(상장 폐지·미지원 종목 필터링).
export async function getStockDetail(symbol: string): Promise<Stock | null> {
  if (!KEY) return null
  try {
    const [profileRes, quoteRes] = await Promise.all([
      fetch(`${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`),
      fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`),
    ])
    const [profile, quote] = await Promise.all([profileRes.json(), quoteRes.json()])

    if (!profile?.name || !quote?.c) return null

    const { market, code } = parseSymbol(symbol)

    return {
      id: symbolToId(symbol),
      name: profile.name,
      nameEn: profile.name,
      code,
      market,
      price: quote.c,
      prevPrice: quote.pc ?? quote.c,
      change: quote.d ?? 0,
      changePercent: quote.dp ?? 0,
      volume: 0,
      sector: profile.finnhubIndustry ?? 'Other',
    }
  } catch {
    return null
  }
}
