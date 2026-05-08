// =====================================================
// 가격 차트 컴포넌트 (components/PriceChart.tsx)
// lightweight-charts 라이브러리를 사용해 캔들스틱 차트를 렌더링한다.
//
// 핵심 동작:
//   1. 차트 인스턴스를 useRef로 보관해 React 리렌더링 시 차트가 재생성되지 않게 한다.
//   2. 기간(period)이 바뀌면 generateCandles()로 새 캔들 데이터를 생성·교체한다.
//   3. currentPrice가 바뀌면 마지막 캔들만 update()해 실시간 변동을 반영한다.
//

// =====================================================

import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { fetchCandles } from '../lib/finnhub'

type Period = '1h' | '1d' | '1w' | '1M' | '1y'

// 캔들 한 개의 데이터 구조 (lightweight-charts 형식)
interface CandlePoint {
  time: number   // Unix 초 단위 타임스탬프
  open: number
  high: number
  low: number
  close: number
}

interface Props {
  stockId: string      // 기간 전환 시 데이터 재생성을 위한 트리거
  currentPrice: number // 실시간 현재가 — 마지막 캔들 업데이트에 사용
  market: 'KR' | 'US' // 가격 반올림 단위 결정용
}

// ── 기간 탭 목록 ──────────────────────────────────
const PERIODS: { value: Period; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '1d', label: '일' },
  { value: '1w', label: '주' },
  { value: '1M', label: '월' },
  { value: '1y', label: '년' },
]

// ── 기간별 캔들 생성 설정 ─────────────────────────
// count: 생성할 캔들 수
// stepMs: 캔들 하나가 커버하는 시간 범위 (ms)
// volatility: 캔들 간 가격 변동 폭 비율
// liveIntervalMs: 이 시간이 지나면 새 캔들 생성
// openCloseBodyOnly: true면 고가·저가가 몸통 범위와 같아짐 (봉 심플화)
// alignTime: 타임스탬프를 hour/day 경계에 정렬할지 여부
interface PeriodConfig {
  count: number
  stepMs: number
  volatility: number
  liveIntervalMs: number
  openCloseBodyOnly?: boolean
  alignTime: 'hour' | 'day' | 'none'
}

const CONFIGS: Record<Period, PeriodConfig> = {
  '1h': {
    count: 48,
    stepMs: 60 * 60_000,
    volatility: 0.003,
    liveIntervalMs: 60 * 60_000,
    alignTime: 'hour',
  },
  '1d': {
    count: 90,
    stepMs: 24 * 60 * 60_000,
    volatility: 0.012,
    liveIntervalMs: 24 * 60 * 60_000,
    openCloseBodyOnly: true,  // 일봉은 심플 표현
    alignTime: 'day',
  },
  '1w': {
    count: 52,
    stepMs: 7 * 24 * 60 * 60_000,
    volatility: 0.02,
    liveIntervalMs: 7 * 24 * 60 * 60_000,
    alignTime: 'none',
  },
  '1M': {
    count: 24,
    stepMs: 30 * 24 * 60 * 60_000,
    volatility: 0.025,
    liveIntervalMs: 30 * 24 * 60 * 60_000,
    alignTime: 'none',
  },
  '1y': {
    count: 12,
    stepMs: 365 * 24 * 60 * 60_000,
    volatility: 0.04,
    liveIntervalMs: 365 * 24 * 60 * 60_000,
    alignTime: 'none',
  },
}

const SEC_DAY = 86400
const SEC_HOUR = 3600

// ── 캔들 타임스탬프 계산 ──────────────────────────
// alignTime 설정에 따라 캔들 시각을 hour/day 경계에 맞춘다.
// lightweight-charts는 같은 period 내 중복 타임스탬프를 허용하지 않아
// 경계 정렬이 필요하다.
function candleTimeSec(nowSec: number, i: number, count: number, cfg: PeriodConfig): number {
  const back = count - 1 - i
  if (cfg.alignTime === 'day') {
    const dayStart = Math.floor(nowSec / SEC_DAY) * SEC_DAY
    return dayStart - back * SEC_DAY
  }
  if (cfg.alignTime === 'hour') {
    const hourStart = Math.floor(nowSec / SEC_HOUR) * SEC_HOUR
    return hourStart - back * SEC_HOUR
  }
  const stepSec = Math.floor(cfg.stepMs / 1000)
  return nowSec - back * stepSec
}

// ── 가격 반올림 ───────────────────────────────────
// KR: 1원 단위 정수, US: 소수점 2자리
function roundPrice(p: number, market: 'KR' | 'US') {
  return market === 'KR' ? Math.round(p) : Math.round(p * 100) / 100
}

// ── 합성 캔들 데이터 생성 ─────────────────────────
// 현재가(basePrice)에서 과거로 역산해 캔들 배열을 만든다.
// closes 배열을 먼저 생성한 뒤 고가·저가를 추가하는 방식을 쓰는 이유:
//   이전 캔들의 종가 = 다음 캔들의 시가 관계를 자연스럽게 유지하기 위함이다.
function generateCandles(basePrice: number, period: Period, market: 'KR' | 'US'): CandlePoint[] {
  const cfg = CONFIGS[period]
  const nowSec = Math.floor(Date.now() / 1000)

  // 현재가부터 과거로 역산한 종가 배열 (unshift로 앞에 추가)
  const closes: number[] = [basePrice]
  for (let i = 1; i < cfg.count; i++) {
    const prev = closes[0]
    const delta = (Math.random() - 0.5) * 2 * cfg.volatility
    closes.unshift(roundPrice(prev / (1 + delta), market))
  }

  const candles: CandlePoint[] = []
  for (let i = 0; i < cfg.count; i++) {
    const close = closes[i]
    // 첫 캔들의 시가는 랜덤, 이후 캔들의 시가는 이전 캔들의 종가
    const open =
      i === 0
        ? roundPrice(close * (1 + (Math.random() - 0.5) * cfg.volatility), market)
        : closes[i - 1]

    let high: number
    let low: number
    if (cfg.openCloseBodyOnly) {
      // 심플 봉: 고가·저가가 몸통(시가·종가) 범위와 동일
      high = Math.max(open, close)
      low = Math.min(open, close)
    } else {
      // 일반 봉: 몸통 위아래에 랜덤 꼬리(wick) 추가
      const bodyHigh = Math.max(open, close)
      const bodyLow = Math.min(open, close)
      const wickRatio = cfg.volatility * (0.4 + Math.random() * 0.6)
      high = roundPrice(bodyHigh * (1 + Math.random() * wickRatio), market)
      low = roundPrice(bodyLow * (1 - Math.random() * wickRatio), market)
    }

    const time = candleTimeSec(nowSec, i, cfg.count, cfg)
    candles.push({ time, open, high, low, close })
  }
  return candles
}

// ── 정렬된 현재 바 타임스탬프 계산 ──────────────
// 실시간 업데이트 시 현재 캔들의 타임스탬프를 경계에 맞춘다.
function alignedBarTimeSec(period: Period, nowMs: number): number {
  const t = Math.floor(nowMs / 1000)
  if (period === '1d') return Math.floor(t / SEC_DAY) * SEC_DAY
  if (period === '1h') return Math.floor(t / SEC_HOUR) * SEC_HOUR
  const stepSec = Math.floor(CONFIGS[period].stepMs / 1000)
  return Math.floor(t / stepSec) * stepSec
}

export default function PriceChart({ stockId, currentPrice, market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)  // 차트 DOM 컨테이너
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)    // lightweight-charts 인스턴스
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null)   // 캔들스틱 시리즈 인스턴스
  const currentCandleRef = useRef<CandlePoint | null>(null)  // 마지막 캔들 상태
  const lastCandleStartRef = useRef<number>(Date.now())       // 현재 캔들 시작 시각
  const periodRef = useRef<Period>('1d')  // 최신 period를 closure 없이 참조하기 위한 ref

  const [period, setPeriod] = useState<Period>('1d')
  const [isLoading, setIsLoading] = useState(true)
  const [summary, setSummary] = useState({ isUp: true, diff: 0, diffPct: 0, open: currentPrice })

  // ── 차트 초기화 (마운트 1회) ───────────────────
  // useEffect 의존성 배열이 빈 배열이므로 컴포넌트 마운트 시 한 번만 실행된다.
  // 차트 인스턴스를 ref에 보관해 리렌더링 때 재생성되지 않게 한다.
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 240,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#F3F4F6' },
        horzLines: { color: '#F3F4F6' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: { mode: 1 },
      // 스크롤·줌 비활성화 — 단순 뷰어 용도이므로 조작 UI를 제거한다
      handleScroll: false,
      handleScale: false,
    })

    // 캔들스틱 색상: 상승=빨강, 하락=파랑 (한국 주식 관례)
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#F04452',
      downColor: '#1B6FE8',
      borderUpColor: '#F04452',
      borderDownColor: '#1B6FE8',
      wickUpColor: '#F04452',
      wickDownColor: '#1B6FE8',
    })

    chartRef.current = chart
    seriesRef.current = series

    // 컨테이너 크기 변경(반응형) 시 차트 너비를 자동으로 조정한다
    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    // 언마운트 시 observer·차트 인스턴스를 정리해 메모리 누수를 방지한다
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // ── 기간 전환 시 실제 데이터 fetch ───────────
  // Yahoo Finance 프록시에서 실제 OHLC 캔들을 가져온다.
  // fetch 실패 또는 데이터 부족 시 합성 데이터로 폴백한다.
  // currentPrice를 의존성에서 제외: 가격 변동은 아래 useEffect에서 마지막 캔들만 update()한다.
  useEffect(() => {
    if (!seriesRef.current) return
    periodRef.current = period
    setIsLoading(true)

    let cancelled = false

    fetchCandles(stockId, period).then((fetched) => {
      if (cancelled || !seriesRef.current) return

      const candles = fetched.length >= 2
        ? fetched
        : generateCandles(currentPrice, period, market)

      seriesRef.current.setData(candles)
      chartRef.current?.timeScale().fitContent()

      const last = candles[candles.length - 1]
      currentCandleRef.current = { ...last }
      lastCandleStartRef.current = Date.now()

      const firstOpen = candles[0].open
      const diff = last.close - firstOpen
      const diffPct = (diff / firstOpen) * 100
      setSummary({ isUp: diff >= 0, diff, diffPct, open: firstOpen })
      setIsLoading(false)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, stockId])

  // ── 실시간 가격 반영 ──────────────────────────
  // currentPrice가 바뀔 때마다 호출되어 마지막 캔들의 close를 갱신한다.
  // liveIntervalMs가 경과하면 새 캔들을 생성하고, 그 이전이면 기존 캔들을 update한다.
  useEffect(() => {
    if (!seriesRef.current || !currentCandleRef.current) return

    const p = periodRef.current
    const cfg = CONFIGS[p]
    const now = Date.now()
    const price = roundPrice(currentPrice, market)
    const elapsed = now - lastCandleStartRef.current

    let updated: CandlePoint

    if (elapsed >= cfg.liveIntervalMs) {
      // 새 캔들 기간이 시작됨 — 이전 종가를 시가로 설정한 새 캔들 생성
      const prevClose = currentCandleRef.current.close
      const barTime = alignedBarTimeSec(p, now)
      updated = {
        time: barTime,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: price,
      }
      if (cfg.openCloseBodyOnly) {
        updated.high = Math.max(updated.open, updated.close)
        updated.low = Math.min(updated.open, updated.close)
      }
      lastCandleStartRef.current = now
    } else {
      // 기존 캔들 업데이트 — 고가·저가 범위를 유지하며 종가만 변경
      const cur = currentCandleRef.current
      let high = Math.max(cur.high, price)
      let low = Math.min(cur.low, price)
      if (cfg.openCloseBodyOnly) {
        high = Math.max(cur.open, price)
        low = Math.min(cur.open, price)
      }
      updated = {
        ...cur,
        high,
        low,
        close: price,
      }
    }

    currentCandleRef.current = updated
    seriesRef.current.update(updated)

    // 현재 기간 기준 등락 요약 업데이트
    const diff = price - summary.open
    const diffPct = summary.open !== 0 ? (diff / summary.open) * 100 : 0
    setSummary((prev) => ({ ...prev, isUp: diff >= 0, diff, diffPct }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice])

  // ── 렌더링 ────────────────────────────────────
  const { isUp, diff, diffPct, open } = summary
  const sign = diff >= 0 ? '+' : ''
  const fmtPrice = (p: number) => (market === 'KR' ? p.toLocaleString() + '원' : `$${p.toFixed(2)}`)

  return (
    <div>
      {/* 기간 선택 탭 */}
      <div className="flex gap-1 mb-3">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              period === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 기간 등락 요약 (변동액 / 변동률 / 시가) */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-sm font-bold ${isUp ? 'text-red-500' : 'text-blue-600'}`}>
          {sign}
          {fmtPrice(Math.abs(diff))}
        </span>
        <span className={`text-xs font-medium ${isUp ? 'text-red-500' : 'text-blue-600'}`}>
          ({sign}
          {diffPct.toFixed(2)}%)
        </span>
        <span className="text-xs text-gray-400 ml-auto">시가 {fmtPrice(open)}</span>
      </div>

      {/* 차트 컨테이너 — lightweight-charts가 이 div에 canvas를 삽입한다 */}
      <div className="relative">
        <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
            <p className="text-xs text-gray-400">차트 로딩 중…</p>
          </div>
        )}
      </div>
    </div>
  )
}
