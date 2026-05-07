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

// ── Yahoo Finance 한국 종목 시세 조회 ─────────────────
// Finnhub 무료 플랜은 KOSPI 실시간 데이터를 지원하지 않으므로
// Yahoo Finance 비공식 API를 사용한다 (API 키 불필요, 지연 시세 제공).
// symbol 형식: '005930.KS', '000660.KS' 등
export async function getKRQuote(symbol: string): Promise<{
  price: number; prevPrice: number; change: number; changePercent: number
} | null> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { Accept: 'application/json' } }
    )
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    return {
      price: meta.regularMarketPrice,
      prevPrice: meta.previousClose ?? meta.regularMarketPrice,
      change: meta.regularMarketChange ?? 0,
      changePercent: meta.regularMarketChangePercent ?? 0,
    }
  } catch {
    return null
  }
}

// ── Yahoo Finance 한국 종목 기준가 조회(고정용) ─────────
// "실시간 무료"가 어려울 때, 당일 시가(없으면 전일 종가)를 기준가로 사용한다.
export async function getKRPrevCloses(symbol: string): Promise<{ close: number; prevClose: number | null } | null> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { Accept: 'application/json' } }
    )
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? []
    if (!Array.isArray(closes) || closes.length === 0) return null

    // 뒤에서부터 유효한 종가 2개(전일, 전전일)를 찾는다.
    const valid: number[] = []
    for (let i = closes.length - 1; i >= 0; i--) {
      const v = closes[i]
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n) || n === 0) continue
      valid.push(n)
      if (valid.length >= 2) break
    }
    if (valid.length === 0) return null

    // valid[0] = 가장 최근 종가(전일), valid[1] = 전전일 종가(없을 수도)
    return { close: valid[0], prevClose: valid[1] ?? null }
  } catch {
    return null
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
