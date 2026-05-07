// =====================================================
// 주식 스토어 (store/stockStore.ts)
// 주가·보유 종목·거래 내역·시장 지수·뉴스 시세 충격을 관리하고
// Supabase DB와 동기화한다.
//
// DB 동기화 전략:
//   - buyStock/sellStock: 로컬 상태를 즉시 갱신(UI 반응성 유지)하고
//     DB 업데이트는 백그라운드에서 비동기로 처리한다(낙관적 업데이트).
//   - loadUserData: 로그인 시 DB에서 보유 종목·거래 내역·잔액을 가져온다.
// =====================================================

import { create } from 'zustand'
import { initialStocks } from '../data/stocks'
import type { Stock, Holding, Transaction, MarketIndex, NewsItem } from '../types'
import { isNewsActiveForPrice, NEWS_PRICE_EFFECT_DELAY_MS } from '../lib/newsDrift'
import { useNewsStore } from './newsStore'
import { supabase } from '../lib/supabaseClient'
import { getQuote, stockIdToSymbol } from '../lib/finnhub'

// ── 예약된 뉴스 시세 충격 타입 ────────────────────
type PendingNewsPriceImpact = {
  newsId: string
  stockIds: string[]
  impact: number
  effectiveAt: number
}

// ── 시세 충격 적용 헬퍼 ──────────────────────────
// ±10% 로 clamp해 주가가 비정상적으로 변하는 것을 방지한다.
function applyImpactToStocks(stocks: Stock[], stockIds: string[], impactPercent: number): Stock[] {
  const clampedImpact = Math.max(-0.1, Math.min(0.1, impactPercent / 100))
  return stocks.map((stock) => {
    if (!stockIds.includes(stock.id)) return stock
    const newPrice =
      stock.market === 'KR'
        ? Math.round(stock.price * (1 + clampedImpact))
        : Math.round(stock.price * (1 + clampedImpact) * 100) / 100
    const change = newPrice - stock.prevPrice
    const changePercent = (change / stock.prevPrice) * 100
    return { ...stock, price: newPrice, change, changePercent }
  })
}

// ── 스토어 인터페이스 ─────────────────────────────
interface StockState {
  stocks: Stock[]
  holdings: Holding[]
  transactions: Transaction[]
  cashBalance: number
  marketIndices: MarketIndex[]
  mockNewsImpactsApplied: boolean
  pendingNewsPriceImpacts: PendingNewsPriceImpact[]
  initCash: (balance: number) => void
  setCashBalance: (balance: number) => void
  loadUserData: (userId: string) => Promise<void>
  updatePrices: () => void
  ensureMockNewsImpactsApplied: () => void
  scheduleDelayedNewsPriceImpact: (item: NewsItem) => void
  flushDueNewsPriceImpacts: () => void
  applyNewsImpact: (stockIds: string[], impact: number) => void
  addExternalStock: (stock: Stock) => void
  syncRealPrices: () => Promise<void>
  syncStockPrice: (stockId: string) => Promise<void>
  buyStock: (stockId: string, quantity: number) => boolean
  sellStock: (stockId: string, quantity: number) => boolean
  getTotalAsset: () => number
  getTotalPnl: () => number
  reset: () => void
}

const INITIAL_CASH = 10_000_000

export const useStockStore = create<StockState>((set, get) => ({
  stocks: initialStocks,
  holdings: [],
  transactions: [],
  cashBalance: INITIAL_CASH,
  mockNewsImpactsApplied: true,
  pendingNewsPriceImpacts: [],
  marketIndices: [
    { name: 'KOSPI', value: 2748.32, change: 12.45, changePercent: 0.45 },
    { name: 'NASDAQ', value: 19234.56, change: -45.23, changePercent: -0.23 },
    { name: 'S&P 500', value: 5421.87, change: 8.12, changePercent: 0.15 },
    { name: 'KOSDAQ', value: 832.45, change: 5.67, changePercent: 0.69 },
  ],

  // ── 현금 초기화 (회원가입 직후) ──────────────────
  // 신규 가입자는 DB 조회 없이 바로 초기값을 설정한다.
  initCash: (balance: number) => set({ cashBalance: balance, holdings: [], transactions: [] }),

  setCashBalance: (balance: number) => set({ cashBalance: balance }),

  // ── DB에서 유저 데이터 로드 (로그인 시 호출) ─────
  // holdings, transactions, cashBalance를 Supabase에서 가져와 로컬 상태에 반영한다.
  loadUserData: async (userId: string) => {
    const [holdingsRes, txRes, profileRes] = await Promise.all([
      supabase.from('holdings').select('*').eq('user_id', userId),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('cash_balance').eq('id', userId).single(),
    ])

    const holdings: Holding[] = (holdingsRes.data ?? []).map((h) => ({
      stockId: h.stock_id,
      stockName: h.stock_name,
      market: h.market as 'KR' | 'US',
      quantity: h.quantity,
      averagePrice: h.average_price,
    }))

    const transactions: Transaction[] = (txRes.data ?? []).map((t) => ({
      id: t.id,
      stockId: t.stock_id,
      stockName: t.stock_name,
      market: t.market as 'KR' | 'US',
      type: t.type as 'BUY' | 'SELL',
      quantity: t.quantity,
      price: t.price,
      totalAmount: t.total_amount,
      createdAt: t.created_at,
    }))

    set({
      holdings,
      transactions,
      cashBalance: profileRes.data?.cash_balance ?? INITIAL_CASH,
    })
  },

  // ── 외부 종목 추가 (Finnhub 검색 결과) ──────────────
  // 로컬 상태에 추가하고, Supabase stocks 테이블에도 upsert한다.
  // pg_cron의 generate_news_item()이 테이블을 읽으므로
  // 다음 실행부터 이 종목도 뉴스 생성 대상에 포함된다.
  addExternalStock: (stock: Stock) => {
    set((state) => {
      if (state.stocks.find((s) => s.id === stock.id)) return state
      return { stocks: [...state.stocks, stock] }
    })
    supabase
      .from('stocks')
      .upsert({ id: stock.id, name: stock.name }, { onConflict: 'id' })
      .then(() => {})
  },

  // ── 전체 초기화 ──────────────────────────────────
  reset: () =>
    set({
      cashBalance: INITIAL_CASH,
      holdings: [],
      transactions: [],
      stocks: initialStocks,
      mockNewsImpactsApplied: false,
      pendingNewsPriceImpacts: [],
    }),

  // ── 주가 시각적 갱신 ─────────────────────────────
  // 3초마다 호출. 실제 가격은 syncRealPrices/syncStockPrice가 담당하고
  // 이 함수는 화면이 정적으로 보이지 않도록 0.3% 이내의 미세 변동만 적용한다.
  updatePrices: () => {
    set((state) => ({
      stocks: state.stocks.map((stock) => {
        const randomChange = (Math.random() - 0.5) * 0.006 // ±0.3%
        const newPrice =
          stock.market === 'KR'
            ? Math.round(stock.price * (1 + randomChange))
            : Math.round(stock.price * (1 + randomChange) * 100) / 100
        const change = newPrice - stock.prevPrice
        const changePercent = (change / stock.prevPrice) * 100
        return { ...stock, price: newPrice, change, changePercent }
      }),
      marketIndices: state.marketIndices.map((idx) => {
        const delta = (Math.random() - 0.5) * 0.2
        const newValue = Math.round((idx.value * (1 + delta / 100)) * 100) / 100
        const change = Math.round((newValue - idx.value + idx.change) * 100) / 100
        const changePercent = Math.round((change / (newValue - change)) * 10000) / 100
        return { ...idx, value: newValue, change, changePercent }
      }),
    }))
  },

  // ── 전체 종목 실시간 가격 동기화 ─────────────────
  // 2분마다 호출. 로컬 30개 종목을 순서대로 Finnhub /quote로 조회한다.
  // 요청 간 200ms 지연으로 분당 60회 무료 제한을 준수한다.
  syncRealPrices: async () => {
    const localStocks = get().stocks.filter(
      (s) => s.id.startsWith('kr-') || s.id.startsWith('us-')
    )
    for (const stock of localStocks) {
      const symbol = stockIdToSymbol(stock.id)
      if (!symbol) continue
      const quote = await getQuote(symbol)
      if (!quote) continue
      set((state) => ({
        stocks: state.stocks.map((s) => (s.id === stock.id ? { ...s, ...quote } : s)),
      }))
      await new Promise((r) => setTimeout(r, 200))
    }
  },

  // ── 단일 종목 실시간 가격 동기화 ─────────────────
  // 종목 상세 페이지에서 30초마다 호출해 현재 보고 있는 종목의 가격을 갱신한다.
  syncStockPrice: async (stockId: string) => {
    const symbol = stockIdToSymbol(stockId)
    if (!symbol) return
    const quote = await getQuote(symbol)
    if (!quote) return
    set((state) => ({
      stocks: state.stocks.map((s) => (s.id === stockId ? { ...s, ...quote } : s)),
    }))
  },

  // ── 초기 mock 뉴스 시세 충격 일괄 적용 ───────────
  ensureMockNewsImpactsApplied: () => {
    set((state) => {
      if (state.mockNewsImpactsApplied) return state
      let stocks = state.stocks
      const pending = [...state.pendingNewsPriceImpacts]
      const feed = useNewsStore.getState().feed
      const now = Date.now()
      for (const news of feed) {
        if (news.sentiment === 'NEUTRAL') continue
        if (isNewsActiveForPrice(news, now)) {
          stocks = applyImpactToStocks(stocks, news.relatedStockIds, news.priceImpact)
        } else if (!pending.some((p) => p.newsId === news.id)) {
          pending.push({
            newsId: news.id,
            stockIds: news.relatedStockIds,
            impact: news.priceImpact,
            effectiveAt: new Date(news.publishedAt).getTime() + NEWS_PRICE_EFFECT_DELAY_MS,
          })
        }
      }
      return { stocks, pendingNewsPriceImpacts: pending, mockNewsImpactsApplied: true }
    })
  },

  // ── 뉴스 시세 충격 예약 ──────────────────────────
  scheduleDelayedNewsPriceImpact: (item: NewsItem) => {
    if (item.sentiment === 'NEUTRAL') return
    const effectiveAt = new Date(item.publishedAt).getTime() + NEWS_PRICE_EFFECT_DELAY_MS
    set((state) => ({
      pendingNewsPriceImpacts: [
        ...state.pendingNewsPriceImpacts,
        { newsId: item.id, stockIds: item.relatedStockIds, impact: item.priceImpact, effectiveAt },
      ],
    }))
  },

  // ── 만료된 예약 충격 반영 ────────────────────────
  flushDueNewsPriceImpacts: () => {
    const now = Date.now()
    set((state) => {
      const due = state.pendingNewsPriceImpacts.filter((p) => p.effectiveAt <= now)
      if (due.length === 0) return state
      let stocks = state.stocks
      for (const p of due) stocks = applyImpactToStocks(stocks, p.stockIds, p.impact)
      return {
        stocks,
        pendingNewsPriceImpacts: state.pendingNewsPriceImpacts.filter((p) => p.effectiveAt > now),
      }
    })
  },

  applyNewsImpact: (stockIds: string[], impact: number) => {
    set((state) => ({ stocks: applyImpactToStocks(state.stocks, stockIds, impact) }))
  },

  // ── 매수 ────────────────────────────────────────
  // 1) 잔액·주가 체크 → 로컬 상태 즉시 갱신
  // 2) 백그라운드에서 holdings upsert + transactions insert + profiles.cash_balance 업데이트
  buyStock: (stockId: string, quantity: number) => {
    const { stocks, holdings, transactions, cashBalance } = get()
    const stock = stocks.find((s) => s.id === stockId)
    if (!stock) return false

    const totalCost = stock.price * quantity
    if (totalCost > cashBalance) return false

    const existingHolding = holdings.find((h) => h.stockId === stockId)
    const newQuantity = (existingHolding?.quantity ?? 0) + quantity
    const newAveragePrice = existingHolding
      ? (existingHolding.averagePrice * existingHolding.quantity + stock.price * quantity) / newQuantity
      : stock.price

    const newHoldings = existingHolding
      ? holdings.map((h) =>
          h.stockId === stockId
            ? { ...h, quantity: newQuantity, averagePrice: newAveragePrice }
            : h
        )
      : [
          ...holdings,
          { stockId, stockName: stock.name, market: stock.market, quantity, averagePrice: stock.price },
        ]

    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      stockId,
      stockName: stock.name,
      market: stock.market,
      type: 'BUY',
      quantity,
      price: stock.price,
      totalAmount: totalCost,
      createdAt: new Date().toISOString(),
    }

    const newCashBalance = cashBalance - totalCost
    set({ holdings: newHoldings, cashBalance: newCashBalance, transactions: [newTransaction, ...transactions] })

    // 백그라운드 DB 동기화
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await Promise.all([
        supabase.from('holdings').upsert(
          {
            user_id: user.id,
            stock_id: stockId,
            stock_name: stock.name,
            market: stock.market,
            quantity: newQuantity,
            average_price: newAveragePrice,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,stock_id' }
        ),
        supabase.from('transactions').insert({
          user_id: user.id,
          stock_id: stockId,
          stock_name: stock.name,
          market: stock.market,
          type: 'BUY',
          quantity,
          price: stock.price,
          total_amount: totalCost,
        }),
        supabase.from('profiles').update({ cash_balance: newCashBalance }).eq('id', user.id),
      ])
    })()

    return true
  },

  // ── 매도 ────────────────────────────────────────
  // 전량 매도 시 holdings 행을 DB에서 삭제한다.
  // 부분 매도 시 quantity를 업데이트(upsert)한다.
  sellStock: (stockId: string, quantity: number) => {
    const { stocks, holdings, transactions, cashBalance } = get()
    const holding = holdings.find((h) => h.stockId === stockId)
    const stock = stocks.find((s) => s.id === stockId)
    if (!holding || !stock || holding.quantity < quantity) return false

    const totalRevenue = stock.price * quantity
    const isFullSell = holding.quantity === quantity
    const newHoldings = isFullSell
      ? holdings.filter((h) => h.stockId !== stockId)
      : holdings.map((h) => (h.stockId === stockId ? { ...h, quantity: h.quantity - quantity } : h))

    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      stockId,
      stockName: stock.name,
      market: stock.market,
      type: 'SELL',
      quantity,
      price: stock.price,
      totalAmount: totalRevenue,
      createdAt: new Date().toISOString(),
    }

    const newCashBalance = cashBalance + totalRevenue
    set({ holdings: newHoldings, cashBalance: newCashBalance, transactions: [newTransaction, ...transactions] })

    // 백그라운드 DB 동기화
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const holdingUpdate = isFullSell
        ? supabase.from('holdings').delete().match({ user_id: user.id, stock_id: stockId })
        : supabase.from('holdings').upsert(
            {
              user_id: user.id,
              stock_id: stockId,
              stock_name: stock.name,
              market: stock.market,
              quantity: holding.quantity - quantity,
              average_price: holding.averagePrice,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,stock_id' }
          )

      await Promise.all([
        holdingUpdate,
        supabase.from('transactions').insert({
          user_id: user.id,
          stock_id: stockId,
          stock_name: stock.name,
          market: stock.market,
          type: 'SELL',
          quantity,
          price: stock.price,
          total_amount: totalRevenue,
        }),
        supabase.from('profiles').update({ cash_balance: newCashBalance }).eq('id', user.id),
      ])
    })()

    return true
  },

  // ── 총 자산 계산 ─────────────────────────────────
  getTotalAsset: () => {
    const { stocks, holdings, cashBalance } = get()
    const stockValue = holdings.reduce((sum, holding) => {
      const stock = stocks.find((s) => s.id === holding.stockId)
      return sum + (stock ? stock.price * holding.quantity : 0)
    }, 0)
    return cashBalance + stockValue
  },

  // ── 총 평가손익 계산 ─────────────────────────────
  getTotalPnl: () => {
    const { stocks, holdings } = get()
    return holdings.reduce((sum, holding) => {
      const stock = stocks.find((s) => s.id === holding.stockId)
      if (!stock) return sum
      return sum + (stock.price - holding.averagePrice) * holding.quantity
    }, 0)
  },
}))
