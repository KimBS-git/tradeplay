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
    set({ isLoading: true })

    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    })

    if (error || !data.user) {
      set({ isLoading: false })
      return false
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      set({ isLoading: false })
      return false
    }

    set({ currentUser: rowToUser(profile), isLoading: false })
    return true
  },

  // ── 회원가입 ────────────────────────────────────────
  // 1) 아이디(username) 중복 확인
  // 2) Supabase Auth signUp
  // 3) profiles 테이블에 사용자 정보 삽입
  signup: async (username, password, name) => {
    set({ isLoading: true })

    // 아이디 중복 확인
    // profiles 테이블은 RLS로 비로그인 상태에서 직접 조회가 불가하므로
    // security definer 함수를 통해 RLS 없이 username 존재 여부만 확인한다.
    const { data: taken } = await supabase.rpc('is_username_taken', { p_username: username })
    if (taken) {
      set({ isLoading: false })
      return false
    }

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(username),
      password,
    })

    if (error || !data.user) {
      set({ isLoading: false })
      return false
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      username,
      display_name: name,
      cash_balance: 10_000_000,
      is_admin: false,
    })

    if (profileError) {
      set({ isLoading: false })
      return false
    }

    set({
      currentUser: {
        uid: data.user.id,
        username,
        displayName: name,
        cashBalance: 10_000_000,
        isAdmin: false,
      },
      isLoading: false,
    })
    return true
  },

  // ── 로그아웃 ────────────────────────────────────────
  // Supabase 세션을 삭제하고 로컬 상태를 초기화한다.
  logout: async () => {
    await supabase.auth.signOut()
    set({ currentUser: null, users: [] })
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
