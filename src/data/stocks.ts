// =====================================================
// 초기 주식 데이터 (data/stocks.ts)
// 앱 최초 로드 시 stockStore에 주입되는 정적 시드(seed) 데이터.
// 실제 API 없이도 시뮬레이터가 동작할 수 있도록 대표 종목을 하드코딩한다.
//
// price와 prevPrice를 동일하게 설정한 이유:
//   앱 시작 시점을 '전일 종가와 현재가가 같은 상태'로 보고,
//   이후 updatePrices()가 호출될 때마다 prevPrice 기준으로 등락이 계산된다.
// =====================================================

import type { Stock } from '../types'

export const initialStocks: Stock[] = [
  // ── 국내 주식 (KR) ────────────────────────────────
  // 코스피 대형주 위주로 구성. 섹터를 다양하게 포함해
  // 뉴스-섹터 상관관계 시뮬레이션이 자연스럽게 이루어지도록 한다.
  { id: 'kr-005930', name: '삼성전자', nameEn: 'Samsung Electronics', code: '005930', market: 'KR', price: 74800, prevPrice: 74800, change: 0, changePercent: 0, volume: 15234567, sector: '반도체' },
  { id: 'kr-000660', name: 'SK하이닉스', nameEn: 'SK Hynix', code: '000660', market: 'KR', price: 197500, prevPrice: 197500, change: 0, changePercent: 0, volume: 3456789, sector: '반도체' },
  { id: 'kr-035420', name: 'NAVER', nameEn: 'NAVER', code: '035420', market: 'KR', price: 212000, prevPrice: 212000, change: 0, changePercent: 0, volume: 876543, sector: 'IT' },
  { id: 'kr-035720', name: '카카오', nameEn: 'Kakao', code: '035720', market: 'KR', price: 43150, prevPrice: 43150, change: 0, changePercent: 0, volume: 2345678, sector: 'IT' },
  { id: 'kr-005380', name: '현대차', nameEn: 'Hyundai Motor', code: '005380', market: 'KR', price: 213500, prevPrice: 213500, change: 0, changePercent: 0, volume: 654321, sector: '자동차' },
  { id: 'kr-000270', name: '기아', nameEn: 'Kia', code: '000270', market: 'KR', price: 98700, prevPrice: 98700, change: 0, changePercent: 0, volume: 1234567, sector: '자동차' },
  { id: 'kr-051910', name: 'LG화학', nameEn: 'LG Chem', code: '051910', market: 'KR', price: 312000, prevPrice: 312000, change: 0, changePercent: 0, volume: 345678, sector: '화학' },
  { id: 'kr-006400', name: '삼성SDI', nameEn: 'Samsung SDI', code: '006400', market: 'KR', price: 178500, prevPrice: 178500, change: 0, changePercent: 0, volume: 456789, sector: '2차전지' },
  { id: 'kr-207940', name: '삼성바이오로직스', nameEn: 'Samsung Biologics', code: '207940', market: 'KR', price: 895000, prevPrice: 895000, change: 0, changePercent: 0, volume: 87654, sector: '바이오' },
  { id: 'kr-068270', name: '셀트리온', nameEn: 'Celltrion', code: '068270', market: 'KR', price: 178000, prevPrice: 178000, change: 0, changePercent: 0, volume: 987654, sector: '바이오' },
  { id: 'kr-003550', name: 'LG', nameEn: 'LG Corp', code: '003550', market: 'KR', price: 87600, prevPrice: 87600, change: 0, changePercent: 0, volume: 234567, sector: '지주' },
  { id: 'kr-096770', name: 'SK이노베이션', nameEn: 'SK Innovation', code: '096770', market: 'KR', price: 112500, prevPrice: 112500, change: 0, changePercent: 0, volume: 567890, sector: '에너지' },
  { id: 'kr-055550', name: '신한지주', nameEn: 'Shinhan Financial', code: '055550', market: 'KR', price: 48650, prevPrice: 48650, change: 0, changePercent: 0, volume: 1345678, sector: '금융' },
  { id: 'kr-105560', name: 'KB금융', nameEn: 'KB Financial', code: '105560', market: 'KR', price: 89400, prevPrice: 89400, change: 0, changePercent: 0, volume: 876543, sector: '금융' },
  { id: 'kr-032830', name: '삼성생명', nameEn: 'Samsung Life', code: '032830', market: 'KR', price: 97500, prevPrice: 97500, change: 0, changePercent: 0, volume: 234567, sector: '보험' },

  // ── 미국 주식 (US) ────────────────────────────────
  // 나스닥·NYSE 대형주. 가격 단위가 달러이므로
  // updatePrices()에서 소수점 2자리로 반올림하는 분기 처리가 따로 이루어진다.
  { id: 'us-AAPL', name: '애플', nameEn: 'Apple Inc.', code: 'AAPL', market: 'US', price: 211.45, prevPrice: 211.45, change: 0, changePercent: 0, volume: 54321098, sector: 'Technology' },
  { id: 'us-MSFT', name: '마이크로소프트', nameEn: 'Microsoft Corp.', code: 'MSFT', market: 'US', price: 415.32, prevPrice: 415.32, change: 0, changePercent: 0, volume: 23456789, sector: 'Technology' },
  { id: 'us-GOOGL', name: '구글', nameEn: 'Alphabet Inc.', code: 'GOOGL', market: 'US', price: 172.85, prevPrice: 172.85, change: 0, changePercent: 0, volume: 18765432, sector: 'Technology' },
  { id: 'us-AMZN', name: '아마존', nameEn: 'Amazon.com Inc.', code: 'AMZN', market: 'US', price: 198.75, prevPrice: 198.75, change: 0, changePercent: 0, volume: 32456789, sector: 'Consumer' },
  { id: 'us-NVDA', name: '엔비디아', nameEn: 'NVIDIA Corp.', code: 'NVDA', market: 'US', price: 135.58, prevPrice: 135.58, change: 0, changePercent: 0, volume: 98765432, sector: 'Semiconductor' },
  { id: 'us-META', name: '메타', nameEn: 'Meta Platforms', code: 'META', market: 'US', price: 578.92, prevPrice: 578.92, change: 0, changePercent: 0, volume: 12345678, sector: 'Technology' },
  { id: 'us-TSLA', name: '테슬라', nameEn: 'Tesla Inc.', code: 'TSLA', market: 'US', price: 248.37, prevPrice: 248.37, change: 0, changePercent: 0, volume: 87654321, sector: 'Automotive' },
  { id: 'us-BRK', name: '버크셔해서웨이', nameEn: 'Berkshire Hathaway', code: 'BRK.B', market: 'US', price: 451.23, prevPrice: 451.23, change: 0, changePercent: 0, volume: 4567890, sector: 'Financial' },
  { id: 'us-JPM', name: 'JP모건', nameEn: 'JPMorgan Chase', code: 'JPM', market: 'US', price: 238.54, prevPrice: 238.54, change: 0, changePercent: 0, volume: 8765432, sector: 'Financial' },
  { id: 'us-JNJ', name: '존슨앤존슨', nameEn: 'Johnson & Johnson', code: 'JNJ', market: 'US', price: 152.87, prevPrice: 152.87, change: 0, changePercent: 0, volume: 6543210, sector: 'Healthcare' },
  { id: 'us-V', name: '비자', nameEn: 'Visa Inc.', code: 'V', market: 'US', price: 287.43, prevPrice: 287.43, change: 0, changePercent: 0, volume: 7654321, sector: 'Financial' },
  { id: 'us-WMT', name: '월마트', nameEn: 'Walmart Inc.', code: 'WMT', market: 'US', price: 95.67, prevPrice: 95.67, change: 0, changePercent: 0, volume: 9876543, sector: 'Consumer' },
  { id: 'us-DIS', name: '디즈니', nameEn: 'Walt Disney Co.', code: 'DIS', market: 'US', price: 89.34, prevPrice: 89.34, change: 0, changePercent: 0, volume: 11234567, sector: 'Entertainment' },
  { id: 'us-NFLX', name: '넷플릭스', nameEn: 'Netflix Inc.', code: 'NFLX', market: 'US', price: 982.15, prevPrice: 982.15, change: 0, changePercent: 0, volume: 3456789, sector: 'Entertainment' },
  { id: 'us-AMD', name: 'AMD', nameEn: 'Advanced Micro Devices', code: 'AMD', market: 'US', price: 118.76, prevPrice: 118.76, change: 0, changePercent: 0, volume: 45678901, sector: 'Semiconductor' },
]
