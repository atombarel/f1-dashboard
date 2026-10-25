import type { Context, MiddlewareHandler } from 'hono'

export const IMMUTABLE = 'public, max-age=31536000, immutable'

/** Browser keeps it `browser` seconds, the edge `edge` seconds, and both may serve stale while refreshing. */
export const shortLived = (browser: number, edge = browser * 2, swr = Math.max(edge * 10, 300)) =>
  `public, max-age=${browser}, s-maxage=${edge}${swr ? `, stale-while-revalidate=${swr}` : ''}`

export const NO_STORE = 'no-store'

async function weakEtag(body: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body))
  return `W/"${[...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`
}

/** JSON with an ETag so revalidations are a cheap 304. */
export async function json(c: Context, value: unknown, cacheControl: string, status: 200 | 202 = 200) {
  const body = JSON.stringify(value)
  const etag = await weakEtag(body)
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    etag,
  }
  if (status === 200 && c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers })
  return new Response(body, { status, headers })
}

/**
 * Stream a gzipped R2 object straight to the client: no decompression, no recompression.
 * `encodeBody: 'manual'` tells the runtime the body is already content-encoded.
 */
export async function r2Gzip(c: Context, bucket: R2Bucket, key: string, cacheControl: string): Promise<Response | null> {
  const etagIn = c.req.header('if-none-match')
  const obj = await bucket.get(key, etagIn ? { onlyIf: { etagDoesNotMatch: etagIn.replace(/^W\//, '').replace(/"/g, '') } } : undefined)
  if (!obj) return null
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-encoding': 'gzip',
    'cache-control': cacheControl,
    etag: obj.httpEtag,
    vary: 'accept-encoding',
  }
  if (!('body' in obj)) return new Response(null, { status: 304, headers })
  return new Response(obj.body, { headers, encodeBody: 'manual' })
}

/**
 * Edge cache for the D1-backed endpoints. Responses opt in through their Cache-Control header;
 * the cache key is the full URL, so versioned (?v=) and unversioned URLs never collide.
 * (Cache API is a no-op on *.workers.dev — it needs a custom domain.)
 */
export const edgeCache: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' || c.req.query('nocache') !== undefined) return next()
  const cache = caches.default
  const key = new Request(c.req.url, { method: 'GET' })
  const hit = await cache.match(key)
  if (hit) {
    const etag = hit.headers.get('etag')
    if (etag && c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers: hit.headers })
    const res = new Response(hit.body, hit)
    res.headers.set('x-edge-cache', 'HIT')
    return res
  }
  await next()
  const res = c.res
  const cc = res.headers.get('cache-control') ?? ''
  if (res.status === 200 && cc.includes('public') && !res.headers.get('content-encoding')) {
    c.executionCtx.waitUntil(cache.put(key, res.clone()))
    res.headers.set('x-edge-cache', 'MISS')
  }
}
