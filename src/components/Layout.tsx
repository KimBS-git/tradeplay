// =====================================================
// 레이아웃 컴포넌트 (components/Layout.tsx)
// 모든 일반 페이지에 공통으로 적용되는 껍데기 레이아웃.
// Header를 포함하고, 하위 라우트의 콘텐츠를 <Outlet>으로 렌더링한다.
//
// React Router의 중첩 라우트(Nested Routes) 패턴을 사용해
// 각 페이지마다 Header를 import하지 않아도 되게 한다.
// =====================================================

import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 고정 헤더 */}
      <Header />
      {/* 페이지 본문 — 최대 너비 제한 및 좌우 패딩 적용 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 현재 활성화된 하위 라우트의 컴포넌트가 여기에 삽입된다 */}
        <Outlet />
      </main>
    </div>
  )
}
