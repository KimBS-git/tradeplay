// Vercel Serverless Function: Yahoo Finance candle proxy
// GET /api/candles?symbol=AAPL&period=1d

const PERIOD_MAP = {
  '1h': { interval: '60m', range: '5d' },
  '1d': { interval: '1d',  range: '3mo' },
  '1w': { interval: '1wk', range: '1y' },
  '1M': { interval: '1mo', range: '2y' },
  '1y': { interval: '3mo', range: '5y' },
}

export default async function handler(req, res) {
  const symbol = String(req.query?.symbol ?? '')
  const period = String(req.query?.period ?? '1d')
  if (!symbol) { res.status(400).json({ error: 'MISSING_SYMBOL' }); return }

  const cfg = PERIOD_MAP[period] ?? PERIOD_MAP['1d']

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${cfg.interval}&range=${cfg.range}`
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) { res.status(upstream.status).json({ error: 'UPSTREAM_ERROR' }); return }

    const result = data?.chart?.result?.[0]
    const timestamps = result?.timestamp
    const quote = result?.indicators?.quote?.[0]
    if (!Array.isArray(timestamps) || !quote) { res.status(502).json({ error: 'INVALID_UPSTREAM' }); return }

    const candles = []
    for (let i = 0; i < timestamps.length; i++) {
      const o = Number(quote.open?.[i])
      const h = Number(quote.high?.[i])
      const l = Number(quote.low?.[i])
      const c = Number(quote.close?.[i])
      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) continue
      if (o === 0 || h === 0 || l === 0 || c === 0) continue
      candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c })
    }

    res.status(200).json({ symbol, period, candles })
  } catch (e) {
    res.status(500).json({ error: 'PROXY_ERROR', message: e instanceof Error ? e.message : 'unknown' })
  }
}
