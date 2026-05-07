// Vercel Serverless Function: Naver News proxy
// GET /api/naver/news?query=증시&display=30&sort=date

import crypto from 'node:crypto'

function stripHtml(input) {
  if (!input) return ''
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function stableIdFromLink(link) {
  return crypto.createHash('sha1').update(String(link ?? '')).digest('hex').slice(0, 16)
}

export default async function handler(req, res) {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    res.status(500).json({
      error: 'NAVER_API_KEYS_MISSING',
      message: 'Vercel 환경변수에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 설정하세요.',
    })
    return
  }

  const query = String(req.query?.query ?? '증시')
  const display = Math.min(Math.max(Number(req.query?.display ?? 30), 1), 100)
  const start = Math.min(Math.max(Number(req.query?.start ?? 1), 1), 1000)
  const sort = String(req.query?.sort ?? 'date')

  try {
    const url = new URL('https://openapi.naver.com/v1/search/news.json')
    url.searchParams.set('query', query)
    url.searchParams.set('display', String(display))
    url.searchParams.set('start', String(start))
    url.searchParams.set('sort', sort)

    const upstream = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })

    const raw = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: 'NAVER_UPSTREAM_ERROR',
        status: upstream.status,
        body: raw,
      })
      return
    }

    const items = Array.isArray(raw?.items) ? raw.items : []
    const mapped = items.map((it) => {
      const link = it?.originallink || it?.link || ''
      const pubDate = it?.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString()
      return {
        id: `naver-${stableIdFromLink(link)}`,
        title: stripHtml(it?.title),
        summary: stripHtml(it?.description) || stripHtml(it?.title),
        url: link,
        source: '네이버뉴스',
        relatedStockIds: [],
        sentiment: 'NEUTRAL',
        priceImpact: 0,
        publishedAt: pubDate,
      }
    })

    res.status(200).json({
      query,
      total: raw?.total ?? 0,
      display: raw?.display ?? display,
      start: raw?.start ?? start,
      items: mapped,
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error('unknown error')
    const cause = err.cause instanceof Error
      ? { name: err.cause.name, message: err.cause.message }
      : (typeof err.cause === 'object' && err.cause ? err.cause : undefined)
    res.status(500).json({
      error: 'NAVER_PROXY_ERROR',
      message: err.message,
      cause,
    })
  }
}
