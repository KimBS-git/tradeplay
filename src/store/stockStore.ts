// =====================================================
// 주식 스토어 (store/stockStore.ts)
// 주가·보유 종목·거래 내역·시장 지수를 관리하고 Supabase DB와 동기화한다.
//
// DB 동기화 전략:
//   - buyStock/sellStock: 로컬 상태를 즉시 갱신(UI 반응성 유지)하고
//     DB 업데이트는 백그라운드에서 비동기로 처리한다(낙관적 업데이트).
//   - loadUserData: 로그인 시 DB에서 보유 종목·거래 내역·잔액을 가져온다.
// =====================================================

import { create } from 'zustand'
import { initialStocks } from '../data/stocks'
import type { Stock, Holding, Transaction, MarketIndex } from '../types'
import { supabase } from '../lib/supabaseClient'
import { getQuote, getKRSnapshot, stockIdToSymbol } from '../lib/finnhub'

// ── 스토어 인터페이스 ─────────────────────────────
interface StockState {
  stocks: Stock[]
  holdings: Holding[]
  transactions: Transaction[]
  cashBalance: number
  marketIndices: MarketIndex[]
  initCash: (balance: number) => void
  setCashBalance: (balance: number) => void
  loadUserData: (userId: string) => Promise<void>
  addExternalStock: (stock: Stock) => void
  syncRealPrices: () => Promise<void>
  syncKRBaselines: () => Promise<void>
  syncStockPrice: (stockId: string) => Promise<void>
  buyStock: (stockId: string, quantity: number, totalKrw: number) => boolean
  sellStock: (stockId: string, quantity: number, totalKrw: number) => boolean
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
    }),

  // ── 전체 종목 실시간 가격 동기화 ─────────────────
  // 2분마다 호출. US 종목만 Finnhub으로 갱신한다. (KR은 기준가 고정)
  // 요청 간 150ms 지연으로 API 제한을 준수한다.
  syncRealPrices: async () => {
    const localStocks = get().stocks.filter(
      (s) => s.id.startsWith('kr-') || s.id.startsWith('us-')
    )
    for (const stock of localStocks) {
      if (stock.market === 'KR') continue
      const symbol = stockIdToSymbol(stock.id)
      if (!symbol) continue
      const quote = await getQuote(symbol) // Finnhub
      if (!quote) continue
      set((state) => ({
        stocks: state.stocks.map((s) => (s.id === stock.id ? { ...s, ...quote } : s)),
      }))
      await new Promise((r) => setTimeout(r, 150))
    }
  },

  // ── KR 종목 가격 동기화(하이브리드) ───────────────
  // 우선순위: regularMarketPrice(현재가) → regularMarketOpen(당일 시가) → 전일 종가
  // 등락은 항상 "전일 종가(prevClose)" 대비로 계산해 색/지표가 일관되게 한다.
  // 앱 시작 시 1회 + 이후 인터벌(120s)에서 반복 호출되어 준실시간으로 갱신된다.
  syncKRBaselines: async () => {
    const krStocks = get().stocks.filter((s) => s.market === 'KR')
    for (const stock of krStocks) {
      const symbol = stockIdToSymbol(stock.id)
      if (!symbol) continue
      const snap = await getKRSnapshot(symbol)
      if (!snap) continue

      // 등락 기준: 메타의 previousClose가 있으면 그걸 우선, 없으면 차트의 전전일 종가
      const prevPrice = snap.previousCloseMeta ?? snap.prevClose ?? snap.close
      // 표시 가격: 현재가 → 시가 → 전일 종가 순
      const price = snap.regularMarketPrice ?? snap.regularMarketOpen ?? snap.close
      const change = price - prevPrice
      const changePercent = prevPrice ? (change / prevPrice) * 100 : 0
      set((state) => ({
        stocks: state.stocks.map((s) =>
          s.id === stock.id
            ? { ...s, price, prevPrice, change, changePercent }
            : s
        ),
      }))
      await new Promise((r) => setTimeout(r, 150))
    }
  },

  // ── 단일 종목 실시간 가격 동기화 ─────────────────
  // 종목 상세 페이지에서 30초마다 호출해 현재 보고 있는 종목의 가격을 갱신한다.
  syncStockPrice: async (stockId: string) => {
    const symbol = stockIdToSymbol(stockId)
    if (!symbol) return
    const stock = get().stocks.find((s) => s.id === stockId)
    if (stock?.market === 'KR') return // KR은 기준가 고정
    const quote = await getQuote(symbol)
    if (!quote) return
    set((state) => ({ stocks: state.stocks.map((s) => (s.id === stockId ? { ...s, ...quote } : s)) }))
  },

  // ── 매수 ────────────────────────────────────────
  // 1) 잔액·주가 체크 → 로컬 상태 즉시 갱신
  // 2) 백그라운드에서 holdings upsert + transactions insert + profiles.cash_balance 업데이트
  // totalKrw: UI에서 환율을 적용해 계산한 원화 주문금액 (KRW 잔액과 직접 비교)
  buyStock: (stockId: string, quantity: number, totalKrw: number) => {
    const { stocks, holdings, transactions, cashBalance } = get()
    const stock = stocks.find((s) => s.id === stockId)
    if (!stock) return false

    if (totalKrw > cashBalance) return false

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
      totalAmount: totalKrw,
      createdAt: new Date().toISOString(),
    }

    const newCashBalance = cashBalance - totalKrw
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
          total_amount: totalKrw,
        }),
        supabase.from('profiles').update({ cash_balance: newCashBalance }).eq('id', user.id),
      ])
    })()

    return true
  },

  // ── 매도 ────────────────────────────────────────
  // 전량 매도 시 holdings 행을 DB에서 삭제한다.
  // 부분 매도 시 quantity를 업데이트(upsert)한다.
  // totalKrw: UI에서 환율을 적용해 계산한 원화 매도금액 (KRW 잔액에 가산)
  sellStock: (stockId: string, quantity: number, totalKrw: number) => {
    const { stocks, holdings, transactions, cashBalance } = get()
    const holding = holdings.find((h) => h.stockId === stockId)
    const stock = stocks.find((s) => s.id === stockId)
    if (!holding || !stock || holding.quantity < quantity) return false

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
      totalAmount: totalKrw,
      createdAt: new Date().toISOString(),
    }

    const newCashBalance = cashBalance + totalKrw
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
          total_amount: totalKrw,
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
