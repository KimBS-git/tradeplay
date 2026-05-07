// =====================================================
// 관심 종목 스토어 (store/watchlistStore.ts)
// 관심 종목 ID 목록을 관리하고 Supabase watchlists 테이블과 동기화한다.
//
// toggle은 낙관적 업데이트(UI 즉시 반영) 후 DB를 백그라운드에서 처리한다.
// loadWatchlist는 로그인 시 1회 호출해 DB에서 목록을 가져온다.
// =====================================================

import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

interface WatchlistState {
  watchlist: string[]
  toggle: (stockId: string) => void
  isWatched: (stockId: string) => boolean
  loadWatchlist: (userId: string) => Promise<void>
  reset: () => void
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  watchlist: [],

  // ── 관심 토글 ────────────────────────────────────
  // 로컬 상태를 먼저 갱신해 UI가 즉각 반응하게 하고,
  // Supabase insert/delete는 백그라운드에서 처리한다.
  toggle: (stockId: string) => {
    const { watchlist } = get()
    const isCurrentlyWatched = watchlist.includes(stockId)

    // 낙관적 업데이트
    set({
      watchlist: isCurrentlyWatched
        ? watchlist.filter((id) => id !== stockId)
        : [...watchlist, stockId],
    })

    // 백그라운드 DB 동기화
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (isCurrentlyWatched) {
        await supabase
          .from('watchlists')
          .delete()
          .match({ user_id: user.id, stock_id: stockId })
      } else {
        await supabase
          .from('watchlists')
          .insert({ user_id: user.id, stock_id: stockId })
      }
    })()
  },

  // ── 관심 여부 확인 ───────────────────────────────
  isWatched: (stockId: string) => get().watchlist.includes(stockId),

  // ── DB에서 관심 목록 로드 (로그인 시 호출) ────────
  loadWatchlist: async (userId: string) => {
    const { data } = await supabase
      .from('watchlists')
      .select('stock_id')
      .eq('user_id', userId)

    if (data) {
      set({ watchlist: data.map((w) => w.stock_id) })
    }
  },

  // ── 로그아웃 시 로컬 상태 초기화 ─────────────────
  reset: () => set({ watchlist: [] }),
}))
