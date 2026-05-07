// =====================================================
// Supabase 클라이언트 (lib/supabaseClient.ts)
// 앱 전역에서 공유하는 Supabase 인스턴스를 생성한다.
// 여러 곳에서 createClient()를 호출하면 커넥션이 중복되므로
// 이 파일에서 단 하나만 생성하고 import해서 사용한다.
// =====================================================
import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''

if (!url || !anonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.')
}

export const supabase = createClient(url, anonKey)
