const STORAGE_KEY = 'fx.usdkrw.v1'

type CachedRate = { rate: number; ts: number }

export async function getUsdKrwRate(): Promise<number> {
  // 1시간 캐시
  const ttlMs = 60 * 60 * 1000
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as CachedRate
      if (typeof c?.rate === 'number' && typeof c?.ts === 'number' && Date.now() - c.ts < ttlMs) {
        return c.rate
      }
    }
  } catch {
    // ignore
  }

  // 무료 환율 소스 (키 불필요): open.er-api.com
  // https://open.er-api.com/v6/latest/USD
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()
    const rate = Number(data?.rates?.KRW)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('invalid rate')
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rate, ts: Date.now() } satisfies CachedRate))
    } catch {
      // ignore
    }
    return rate
  } catch {
    // 폴백
    return 1380
  }
}

