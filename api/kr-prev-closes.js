// Vercel Serverless Function: KR prev closes proxy
// GET /api/kr-prev-closes?symbol=005930.KS

export default async function handler(req, res) {
  const symbol = String(req.query?.symbol ?? '')
  if (!symbol) {
    res.status(400).json({ error: 'MISSING_SYMBOL' })
    return
  }

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'UPSTREAM_ERROR', status: upstream.status, body: data })
      return
    }

    const result = data?.chart?.result?.[0]
    const closes = result?.indicators?.quote?.[0]?.close
    if (!Array.isArray(closes)) {
      res.status(502).json({ error: 'INVALID_UPSTREAM' })
      return
    }

    const valid = []
    for (let i = closes.length - 1; i >= 0; i--) {
      const n = Number(closes[i])
      if (!Number.isFinite(n) || n === 0) continue
      valid.push(n)
      if (valid.length >= 2) break
    }

    if (valid.length === 0) {
      res.status(404).json({ error: 'NO_CLOSES' })
      return
    }

    const meta = result?.meta ?? {}
    const numOrNull = (v) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }

    res.status(200).json({
      symbol,
      close: valid[0],
      prevClose: valid[1] ?? null,
      regularMarketPrice: numOrNull(meta?.regularMarketPrice),
      regularMarketOpen: numOrNull(meta?.regularMarketOpen),
      previousCloseMeta: numOrNull(meta?.previousClose),
    })
  } catch (e) {
    res.status(500).json({ error: 'PROXY_ERROR', message: e instanceof Error ? e.message : 'unknown' })
  }
}
