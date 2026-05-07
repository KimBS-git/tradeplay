// =====================================================
// 인증 스토어 (store/authStore.ts)
// Supabase Auth 기반 로그인·회원가입·로그아웃 및 유저 관리.
//
// Supabase Auth는 이메일 형식만 지원하므로
// username → `${username}@tradeplay.local` 로 내부 변환해 사용한다.
// 사용자에게는 "아이디" UI로만 표시된다.
// =====================================================

import { create } from 'zustand'
import type { User } from '../types'
import { supabase } from '../lib/supabaseClient'
import { useWatchlistStore } from './watchlistStore'
import { useStockStore } from './stockStore'

// username을 Supabase Auth용 이메일로 변환
function toEmail(username: string) {
  return `${username}@tradeplay.local`
}

// profiles 테이블 row를 앱의 User 타입으로 변환
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(profile: any): User {
  return {
    uid: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    cashBalance: profile.cash_balance,
    isAdmin: profile.is_admin,
  }
}

// ── 스토어 인터페이스 ──────────────────────────────
interface AuthState {
  currentUser: User | null
  users: User[]       // 관리자 전용 — loadAllUsers()로 채움
  isLoading: boolean
  /** 마지막 로그인/가입 시도에서 발생한 사람-읽기용 에러 메시지 (UI 표시용) */
  lastAuthError: string | null
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  signup: (username: string, password: string, name: string) => Promise<boolean>
  logout: () => Promise<void>
  chargeUser: (uid: string, amount: number) => Promise<void>
  syncBalance: (balance: number) => Promise<void>
  loadAllUsers: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  users: [],
  isLoading: false,
  lastAuthError: null,

  // ── 세션 복원 (앱 시작 시 1회) ────────────────────
  // 브라우저에 저장된 Supabase 세션이 있으면 currentUser를 복원한다.
  // 새로고침 후에도 로그인 상태가 유지되게 한다.
  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profile) {
      set({ currentUser: rowToUser(profile) })
    }
  },

  // ── 로그인 ─────────────────────────────────────────
  // Supabase signInWithPassword 후 profiles 테이블에서 상세 정보를 조회한다.
  login: async (username, password) => {
    set({ isLoading: true, lastAuthError: null })

    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    })

    if (error || !data.user) {
      console.warn('[auth] login failed', error)
      set({
        isLoading: false,
        lastAuthError:
          error?.message ?? '아이디 또는 비밀번호가 올바르지 않습니다.',
      })
      return false
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      console.warn('[auth] profile missing for', data.user.id, profileError)
      set({
        isLoading: false,
        lastAuthError:
          profileError?.message ??
          '프로필을 찾을 수 없습니다. 관리자에게 문의하세요.',
      })
      return false
    }

    set({ currentUser: rowToUser(profile), isLoading: false, lastAuthError: null })
    return true
  },

  // ── 회원가입 ────────────────────────────────────────
  // 1) Supabase Auth signUp 시도 (이메일/username 중복은 여기서 검출)
  // 2) profiles 행은 DB 트리거(handle_new_user)로 자동 생성됨
  // 3) 세션이 즉시 생성되면 currentUser를 채우고, 아니면 사용자에게 안내 메시지를 남긴다.
  signup: async (username, password, name) => {
    set({ isLoading: true, lastAuthError: null })

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(username),
      password,
      options: {
        data: { username, display_name: name },
      },
    })

    if (error || !data.user) {
      console.warn('[auth] signUp failed', error)
      const msg = (error?.message ?? '').toLowerCase()
      const friendly = msg.includes('already') || msg.includes('registered')
        ? '이미 사용 중인 아이디입니다.'
        : error?.message ?? '회원가입에 실패했습니다.'
      set({ isLoading: false, lastAuthError: friendly })
      return false
    }

    // 세션이 함께 발급된 경우(이메일 확인 OFF) 즉시 currentUser를 세팅한다.
    if (data.session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profile) {
        set({ currentUser: rowToUser(profile), isLoading: false, lastAuthError: null })
        return true
      }
    }

    // 이메일 확인이 켜져 있으면 세션이 없을 수 있다 — 가입 자체는 성공한 상태.
    set({
      isLoading: false,
      lastAuthError:
        'Supabase 이메일 확인 설정이 켜져 있어 자동 로그인되지 않았습니다. 관리자에게 문의하거나 Auth 설정에서 Confirm email을 OFF 해주세요.',
    })
    return false
  },

  // ── 로그아웃 ────────────────────────────────────────
  // Supabase 세션을 삭제하고 모든 유저별 로컬 상태를 초기화한다.
  // watchlist·holdings·transactions를 함께 지워야 다음 유저가
  // 이전 유저의 데이터를 보지 않는다.
  logout: async () => {
    await supabase.auth.signOut()
    set({ currentUser: null, users: [] })
    useWatchlistStore.getState().reset()
    useStockStore.getState().reset()
  },

  // ── 잔액 충전 (관리자 전용) ──────────────────────────
  // profiles 테이블의 cash_balance를 업데이트하고 로컬 users 목록도 갱신한다.
  chargeUser: async (uid, amount) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('cash_balance')
      .eq('id', uid)
      .single()

    if (!profile) return

    const newBalance = profile.cash_balance + amount

    await supabase
      .from('profiles')
      .update({ cash_balance: newBalance })
      .eq('id', uid)

    set((state) => ({
      users: state.users.map((u) =>
        u.uid === uid ? { ...u, cashBalance: newBalance } : u
      ),
      currentUser:
        state.currentUser?.uid === uid
          ? { ...state.currentUser, cashBalance: newBalance }
          : state.currentUser,
    }))
  },

  // ── 잔액 동기화 ─────────────────────────────────────
  // stockStore에서 매수·매도가 완료될 때 profiles.cash_balance를 최신으로 유지한다.
  syncBalance: async (balance) => {
    const { currentUser } = get()
    if (!currentUser) return

    await supabase
      .from('profiles')
      .update({ cash_balance: balance })
      .eq('id', currentUser.uid)

    set((state) => ({
      currentUser: state.currentUser
        ? { ...state.currentUser, cashBalance: balance }
        : null,
    }))
  },

  // ── 전체 유저 목록 로드 (관리자 전용) ──────────────
  // profiles_select RLS 정책에서 관리자는 모든 행을 볼 수 있다.
  loadAllUsers: async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', false)
      .order('created_at', { ascending: true })

    if (!profiles) return

    set({ users: profiles.map(rowToUser) })
  },
}))
