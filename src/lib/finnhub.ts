// =====================================================
// Finnhub API 클라이언트 (lib/finnhub.ts)
// 실제 종목 검색, 현재가, 뉴스를 가져온다.
// 무료 tier: 분당 60회 호출 가능.
//
// 설계:
//   - searchSymbols: 헤더 검색창 입력 시 종목명·코드 검색
//   - getStockDetail: 검색 결과 클릭 시 회사 정보와 현재가를 한 번에 가져온다
//   - getQuote: 단일 종목 실시간 현재가 조회
//   - getMarketNews: 시장 전반 실제 뉴스 조회
//   - getCompanyNews: 특정 종목 실제 뉴스 조회
// =====================================================

import type { Stock, NewsItem } from '../types'

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

// ── 로컬 종목 ID → Finnhub 심볼 변환 ─────────────────
// getQuote 등 Finnhub API 호출 시 심볼이 필요하므로 역방향 변환을 제공한다.
// kr-005930 → 005930.KS, us-AAPL → AAPL, fh-TSMC → TSMC
export function stockIdToSymbol(id: string): string | null {
  if (id.startsWith('fh-')) return id.slice(3)
  if (id.startsWith('kr-')) return `${id.slice(3)}.KS`
  if (id.startsWith('us-')) return id.slice(3)
  return null
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

// ── Finnhub 미국 종목 현재가 조회 ────────────────────
// price가 0이면 데이터 없음(미지원 종목 등)으로 처리해 null을 반환한다.
export async function getQuote(symbol: string): Promise<{
  price: number; prevPrice: number; change: number; changePercent: number
} | null> {
  if (!KEY) return null
  try {
    const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`)
    const q = await res.json()
    if (!q?.c || q.c === 0) return null
    return {
      price: q.c,
      prevPrice: q.pc ?? q.c,
      change: q.d ?? 0,
      changePercent: q.dp ?? 0,
    }
  } catch {
    return null
  }
}

// ── Yahoo Finance 한국 종목 스냅샷 조회 ─────────────────
// 하이브리드 가격 적용용: 현재가(regularMarketPrice) 우선,
// 폴백으로 당일 시가(regularMarketOpen) → 전일 종가(previousClose/close) 순.
// 등락은 항상 전일 종가(prevClose) 기준으로 계산한다.
export async function getKRSnapshot(symbol: string): Promise<{
  close: number
  prevClose: number | null
  regularMarketPrice: number | null
  regularMarketOpen: number | null
  previousCloseMeta: number | null
} | null> {
  try {
    // 배포 환경(Vercel)에서 Yahoo 직접 호출은 CORS로 실패할 수 있어
    // 서버(/api)에서 프록시한 엔드포인트를 통해 가져온다.
    const res = await fetch(`/api/kr-prev-closes?symbol=${encodeURIComponent(symbol)}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      close?: number
      prevClose?: number | null
      regularMarketPrice?: number | null
      regularMarketOpen?: number | null
      previousCloseMeta?: number | null
    }
    if (!data?.close || !Number.isFinite(Number(data.close))) return null
    const num = (v: unknown) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return {
      close: Number(data.close),
      prevClose: data.prevClose == null ? null : Number(data.prevClose),
      regularMarketPrice: num(data.regularMarketPrice),
      regularMarketOpen: num(data.regularMarketOpen),
      previousCloseMeta: num(data.previousCloseMeta),
    }
  } catch {
    return null
  }
}

// ── 회사 정보 + 현재가 조회 ──────────────────────────
// 미국 주식: Finnhub profile2 + quote 병렬 호출
// 한국 주식: Finnhub quote는 무료 플랜에서 KR을 지원하지 않으므로
//            Yahoo Finance 프록시(getKRSnapshot)로 가격을 가져온다.
export async function getStockDetail(symbol: string): Promise<Stock | null> {
  if (!KEY) return null
  try {
    const { market, code } = parseSymbol(symbol)

    if (market === 'KR') {
      const [profileRes, snap] = await Promise.all([
        fetch(`${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`),
        getKRSnapshot(symbol),
      ])
      const profile = await profileRes.json()
      if (!snap) return null

      const price = snap.regularMarketPrice ?? snap.regularMarketOpen ?? snap.close
      const prevPrice = snap.previousCloseMeta ?? snap.prevClose ?? snap.close
      const change = price - prevPrice
      const changePercent = prevPrice ? (change / prevPrice) * 100 : 0

      return {
        id: symbolToId(symbol),
        name: profile?.name || code,
        nameEn: profile?.name || code,
        code,
        market,
        price,
        prevPrice,
        change,
        changePercent,
        volume: 0,
        sector: profile?.finnhubIndustry ?? 'Other',
      }
    }

    // 미국 주식: Finnhub profile2 + quote
    const [profileRes, quoteRes] = await Promise.all([
      fetch(`${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`),
      fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`),
    ])
    const [profile, quote] = await Promise.all([profileRes.json(), quoteRes.json()])

    if (!profile?.name || !quote?.c) return null

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

// ── Finnhub 뉴스 기사 내부 타입 ──────────────────────
interface FinnhubArticle {
  id: number
  headline: string
  summary: string
  source: string
  url: string
  datetime: number // Unix timestamp (초 단위)
}

// ── Finnhub 기사 → NewsItem 변환 헬퍼 ───────────────
function articleToNewsItem(article: FinnhubArticle, relatedStockIds: string[]): NewsItem {
  return {
    id: `fh-news-${article.id}`,
    title: article.headline,
    summary: article.summary || article.headline,
    url: article.url,
    source: article.source,
    relatedStockIds,
    sentiment: 'NEUTRAL',
    priceImpact: 0,
    publishedAt: new Date(article.datetime * 1000).toISOString(),
  }
}

// ── 시장 전반 뉴스 조회 ──────────────────────────────
// Finnhub /news?category=general 최신 30건을 가져온다.
export async function getMarketNews(): Promise<NewsItem[]> {
  if (!KEY) return []
  try {
    const res = await fetch(`${BASE}/news?category=general&token=${KEY}`)
    const articles = (await res.json()) as FinnhubArticle[]
    if (!Array.isArray(articles)) return []
    return articles.slice(0, 30).map((a) => articleToNewsItem(a, []))
  } catch {
    return []
  }
}

// ── 특정 종목 뉴스 조회 ─────────────────────────────
// 지난 7일간 종목 관련 뉴스를 최대 20건 가져온다.
// stockId를 relatedStockIds에 포함해 종목 상세 페이지 뉴스 필터가 동작하도록 한다.
export async function getCompanyNews(stockId: string): Promise<NewsItem[]> {
  const symbol = stockIdToSymbol(stockId)
  if (!KEY || !symbol) return []
  try {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const res = await fetch(
      `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${KEY}`
    )
    const articles = (await res.json()) as FinnhubArticle[]
    if (!Array.isArray(articles)) return []
    return articles.slice(0, 20).map((a) => articleToNewsItem(a, [stockId]))
  } catch {
    return []
  }
}
