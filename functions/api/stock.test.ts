import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, type Env } from './stock'

const sheetId = 'test-sheet-id'
let privateKeyPem = ''
let publicKeySpki: ArrayBuffer

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const binary = Array.from(der, (byte) => String.fromCharCode(byte)).join('')
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`
  publicKeySpki = await crypto.subtle.exportKey('spki', pair.publicKey)
})

beforeEach(() => {
  vi.unstubAllGlobals()
})

const env = (): Env => ({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'stock-reader@example.iam.gserviceaccount.com',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKeyPem,
  STOCK_SHEET_ID: sheetId,
})

describe('Cloudflare stock endpoint', () => {
  it('returns only non-empty product IDs from the private Products sheet', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [[''], ['p022'], [''], ['p023 '], ['p022']] }), { status: 200 }))
    vi.stubGlobal('fetch', fakeFetch)

    const response = await onRequestGet({
      request: new Request('https://shop.example/api/stock'),
      env: env(),
    })

    expect(response.status).toBe(200)
    const result = await response.json() as { stockCodes: string[]; checkedAt: string }
    expect(result).toMatchObject({ stockCodes: ['p022', 'p023'], checkedAt: expect.any(String) })
    expect(JSON.stringify(result)).not.toContain('private spreadsheet')
    expect(response.headers.get('cache-control')).toContain('s-maxage=30')
    expect(fakeFetch).toHaveBeenCalledTimes(2)
    const [, tokenOptions] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const assertion = new URLSearchParams(String(tokenOptions.body)).get('assertion')
    expect(assertion).not.toBeNull()
    const [headerSegment, payloadSegment, signatureSegment] = assertion!.split('.')
    const decodeBase64Url = (value: string) => atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
    expect(JSON.parse(decodeBase64Url(headerSegment))).toMatchObject({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(decodeBase64Url(payloadSegment))).toMatchObject({
      iss: 'stock-reader@example.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
    })
    const verifyKey = await crypto.subtle.importKey('spki', publicKeySpki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const signature = Uint8Array.from(decodeBase64Url(signatureSegment), (character) => character.charCodeAt(0))
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', verifyKey, signature, new TextEncoder().encode(`${headerSegment}.${payloadSegment}`))).toBe(true)
    const [sheetUrl, sheetOptions] = fakeFetch.mock.calls[1] as [string, RequestInit]
    expect(decodeURIComponent(sheetUrl)).toContain("'Products'!A2:A1000")
    expect(new Headers(sheetOptions.headers).get('authorization')).toBe('Bearer test-access-token')
  })

  it('returns a configuration error without contacting Google when secrets are missing', async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal('fetch', fakeFetch)

    const response = await onRequestGet({ request: new Request('https://shop.example/api/stock'), env: {} })

    expect(response.status).toBe(503)
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('does not expose Google API error details to the public response', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('private spreadsheet details', { status: 403 }))
    vi.stubGlobal('fetch', fakeFetch)

    const response = await onRequestGet({
      request: new Request('https://shop.example/api/stock'),
      env: env(),
    })

    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private spreadsheet details')
  })

  it('uses the Cloudflare edge cache before requesting Google', async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response(JSON.stringify({ stockCodes: ['p026'], checkedAt: '2026-10-06T00:00:00.000Z' }), { status: 200 })),
      put: vi.fn(),
    }
    const fakeFetch = vi.fn()
    vi.stubGlobal('caches', { default: cache })
    vi.stubGlobal('fetch', fakeFetch)

    const response = await onRequestGet({ request: new Request('https://shop.example/api/stock'), env: env() })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ stockCodes: ['p026'] })
    expect(cache.match).toHaveBeenCalledOnce()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('stores a fresh public stock response in the edge cache', async () => {
    const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) }
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [['p022']] }), { status: 200 }))
    const waitUntil = vi.fn()
    vi.stubGlobal('caches', { default: cache })
    vi.stubGlobal('fetch', fakeFetch)

    await onRequestGet({ request: new Request('https://shop.example/api/stock'), env: env(), waitUntil })

    expect(cache.match).toHaveBeenCalledOnce()
    expect(cache.put).toHaveBeenCalledOnce()
    expect(waitUntil).toHaveBeenCalledOnce()
    const [cacheKey] = cache.match.mock.calls[0] as [Request]
    expect(cacheKey.url).toContain(sheetId)
  })
})
