/** R2 layout. Everything below `bundles/`, `tel/`, `replay/` is immutable once its version is published. */
export const keys = {
  bundle: (session: number, version: string) => `bundles/${session}/${version}.json.gz`,
  telemetry: (session: number, version: string, driver: number) => `tel/${session}/${version}/${driver}.json.gz`,
  replay: (session: number, version: string) => `replay/${session}/${version}.json.gz`,
  circuit: (circuitKey: number, year: number) => `circuits/${circuitKey}-${year}.json.gz`,
  standings: (year: number, version: string) => `standings/${year}/${version}.json.gz`,
  scratch: (session: number, run: string, name: string) => `tmp/${session}/${run}/${name}.json.gz`,
}

export async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

export async function putJson(bucket: R2Bucket, key: string, value: unknown): Promise<number> {
  const body = await gzip(JSON.stringify(value))
  // Stored as an opaque gzip blob (no contentEncoding metadata) so nothing between R2 and
  // the Worker decompresses it behind our back; the API serves the bytes as-is.
  await bucket.put(key, body, { httpMetadata: { contentType: 'application/gzip' } })
  return body.byteLength
}

export async function getJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key)
  if (!obj) return null
  const text = await new Response(obj.body.pipeThrough(new DecompressionStream('gzip'))).text()
  return JSON.parse(text) as T
}

/** Short content hash used as an immutable version tag. */
export async function contentHash(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
