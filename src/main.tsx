// =====================================================
// 애플리케이션 진입점 (main.tsx)
// React 앱을 DOM에 마운트하는 최상위 파일.
// StrictMode를 사용해 개발 중 잠재적인 부작용을 조기에 감지한다.
// =====================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// index.html의 <div id="root"> 요소에 React 앱을 렌더링한다.
// '!'는 해당 요소가 반드시 존재함을 TypeScript에 알려주는 non-null assertion이다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
