export interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string
  STOCK_SHEET_ID?: string
  STOCK_SHEET_TAB?: string
}

export interface PagesContext {
  request: Request
  env: Env
  waitUntil?: (promise: Promise<unknown>) => void
}

interface WorkerCache {
  match(request: Request): Promise<Response | null>
  put(request: Request, response: Response): Promise<void>
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const CACHE_CONTROL = 'public, max-age=0, s-maxage=30'

// Column I (index 8) is the 上架 checkbox; only checked rows are listed.
const LISTED_COLUMN_INDEX = 8

export function isListed(value: unknown): boolean {
  if (value === true) return true
  return typeof value === 'string' && value.trim().toUpperCase() === 'TRUE'
}

function getWorkerCache(): WorkerCache | undefined {
  return (globalThis as unknown as { caches?: { default?: WorkerCache } }).caches?.default
}

function stockCacheKey(request: Request, sheetId: string, sheetTab: string): Request {
  const url = new URL(request.url)
  url.search = ''
  url.searchParams.set('__stock_sheet', sheetId)
  url.searchParams.set('__stock_tab', sheetTab)
  return new Request(url, { method: 'GET' })
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodePrivateKey(pemValue: string): ArrayBuffer {
  const pem = pemValue.replace(/\\n/g, '\n')
  const encoded = pem.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)?.[1]
  if (!encoded) throw new Error('Invalid service account key')
  const binary = atob(encoded.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

async function createServiceAssertion(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })))
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodePrivateKey(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

async function getAccessToken(email: string, privateKeyPem: string, signal: AbortSignal): Promise<string> {
  const assertion = await createServiceAssertion(email, privateKeyPem)
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal,
  })
  if (!response.ok) throw new Error('Google token exchange failed')
  const token = await response.json() as { access_token?: unknown }
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Google token response invalid')
  return token.access_token
}

function jsonResponse(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function onRequestGet({ request, env, waitUntil }: PagesContext): Promise<Response> {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const sheetId = env.STOCK_SHEET_ID?.trim()
  const sheetTab = env.STOCK_SHEET_TAB?.trim() || 'Products'

  if (!email || !privateKey || !sheetId) {
    return jsonResponse({ error: 'Stock feed is not configured' }, 503, 'no-store')
  }

  const cache = getWorkerCache()
  const cacheKey = stockCacheKey(request, sheetId, sheetTab)
  if (cache) {
    try {
      const cached = await cache.match(cacheKey)
      if (cached) return cached
    } catch {
      // A cache miss or cache failure should not prevent the private Sheets read.
    }
  }

  try {
    const token = await getAccessToken(email, privateKey, request.signal)
    const escapedTab = sheetTab.replace(/'/g, "''")
    const range = `'${escapedTab}'!A2:I1000`
    const url = new URL(`${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`)
    url.searchParams.set('majorDimension', 'ROWS')
    url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE')
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: request.signal,
    })
    if (!response.ok) throw new Error('Google Sheets read failed')

    const sheetData = await response.json() as { values?: unknown }
    const values = Array.isArray(sheetData.values) ? sheetData.values : []
    const stockCodes = [...new Set(values.flatMap((row) => {
      if (!Array.isArray(row)) return []
      if (!isListed(row[LISTED_COLUMN_INDEX])) return []
      const value = row[0]
      if (typeof value !== 'string' && typeof value !== 'number') return []
      const code = String(value).trim()
      return code ? [code] : []
    }))]

    const result = jsonResponse({ stockCodes, checkedAt: new Date().toISOString() }, 200, CACHE_CONTROL)
    if (cache) {
      const write = cache.put(cacheKey, result.clone()).catch(() => undefined)
      if (waitUntil) waitUntil(write)
      else await write
    }
    return result
  } catch {
    return jsonResponse({ error: 'Stock feed temporarily unavailable' }, 502, 'no-store')
  }
}
