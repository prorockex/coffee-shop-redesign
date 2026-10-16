import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost, type Env } from './orders'

let privateKeyPem = ''
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const base64 = btoa(Array.from(der, (byte) => String.fromCharCode(byte)).join(''))
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\\n${base64}\\n-----END PRIVATE KEY-----`
  env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKeyPem
})

const env: Env = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'orders@example.iam.gserviceaccount.com',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'unused-in-test',
  STOCK_SHEET_ID: 'inventory-sheet',
  STOCK_SHEET_TAB: 'Products',
  ORDER_SHEET_ID: 'private-orders-sheet',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec',
  APPS_SCRIPT_BRIDGE_TOKEN: 'local-test-bridge-token',
  TURNSTILE_SECRET: 'turnstile-test-secret',
  STOREFRONT_ORIGIN: 'https://coffee-shop-redesign.pages.dev',
}

const validOrder = {
  customerName: '測試顧客',
  phone: '0912345678',
  deliveryMethod: 'convenience_store',
  storeInfo: '7-ELEVEN 測試門市 123456',
  note: '請先電話聯絡',
  items: [{ productId: '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', size: 'half', quantity: 2 }],
  privacyConsent: true,
  turnstileToken: 'valid-challenge',
  website: '',
}

beforeEach(() => vi.unstubAllGlobals())

describe('public order endpoint', () => {
  it('rejects orders when privacy consent is missing without contacting providers', async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal('fetch', fakeFetch)
    const response = await onRequestPost({
      request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
        method: 'POST', headers: { origin: env.STOREFRONT_ORIGIN!, 'content-type': 'application/json' },
        body: JSON.stringify({ ...validOrder, privacyConsent: false }),
      }), env,
    })
    expect(response.status).toBe(400)
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('rejects cross-origin submissions', async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal('fetch', fakeFetch)
    const response = await onRequestPost({
      request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
        method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: JSON.stringify(validOrder),
      }), env,
    })
    expect(response.status).toBe(403)
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('does not write orders containing products that are no longer in stock', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, hostname: 'coffee-shop-redesign.pages.dev', action: 'order' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [['P024', '衣索比亞 歐若米雅 吉瑪莉姆', '衣索比亞', '', '水洗', '白花', 350, 690, true], ['P022', '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', '衣索比亞', '', '水洗', '白花', 350, 690, false]] }), { status: 200 }))
    vi.stubGlobal('fetch', fakeFetch)
    const response = await onRequestPost({
      request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
        method: 'POST', headers: { origin: env.STOREFRONT_ORIGIN!, 'content-type': 'application/json' },
        body: JSON.stringify(validOrder),
      }), env,
    })
    expect(response.status).toBe(409)
    expect(fakeFetch).toHaveBeenCalledTimes(3)
  })

  it('follows the Apps Script ContentService redirect before confirming the saved order', async () => {
    let orderId = ''
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, hostname: 'coffee-shop-redesign.pages.dev', action: 'order' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [['P022', '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', '衣索比亞', '', '水洗', '白花', 350, 690, true]] }), { status: 200 }))
      .mockImplementationOnce(async (_url, options) => {
        orderId = (JSON.parse(String((options as RequestInit).body)) as { orderId: string }).orderId
        return new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/macros/echo?result=test' } })
      })
      .mockImplementationOnce(async () => new Response(JSON.stringify({ status: 'success', orderId, notification: 'sent' }), { status: 200 }))
    vi.stubGlobal('fetch', fakeFetch)
    const response = await onRequestPost({
      request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
        method: 'POST', headers: { origin: env.STOREFRONT_ORIGIN!, 'content-type': 'application/json' },
        body: JSON.stringify(validOrder),
      }), env,
    })
    expect(response.status).toBe(201)
    const result = await response.json() as Record<string, unknown>
    expect(result).toMatchObject({ subtotal: 700, shipping: 60, total: 760, currency: 'TWD', ownerNotified: true })
    expect(result.orderId).toBe(orderId)
    expect(fakeFetch).toHaveBeenCalledTimes(5)
    const [, initialOptions] = fakeFetch.mock.calls[3] as [string, RequestInit]
    expect(initialOptions.redirect).toBe('manual')
    const [echoUrl, echoOptions] = fakeFetch.mock.calls[4] as [string, RequestInit]
    expect(String(echoUrl)).toBe('https://script.googleusercontent.com/macros/echo?result=test')
    expect(echoOptions.method).toBe('GET')
  })

  it('rechecks stock, calculates the shipping total, and appends only after Turnstile succeeds', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, hostname: 'coffee-shop-redesign.pages.dev', action: 'order' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [['P022', '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', '衣索比亞', '', '水洗', '白花', 350, 690, true]] }), { status: 200 }))
      .mockImplementationOnce(async (_url, options) => {
        const requestBody = JSON.parse(String((options as RequestInit).body)) as { orderId: string }
        return new Response(JSON.stringify({ status: 'success', orderId: requestBody.orderId, notification: 'sent' }), { status: 200 })
      })
    vi.stubGlobal('fetch', fakeFetch)
    const response = await onRequestPost({
      request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
        method: 'POST', headers: { origin: env.STOREFRONT_ORIGIN!, 'content-type': 'application/json' },
        body: JSON.stringify(validOrder),
      }), env,
    })
    expect(response.status).toBe(201)
    const result = await response.json() as Record<string, unknown>
    expect(result).toMatchObject({ subtotal: 700, shipping: 60, total: 760, currency: 'TWD', ownerNotified: true })
    expect(result.orderId).toMatch(/^QC-\d{8}-[A-F0-9]{8}$/)
    expect(fakeFetch).toHaveBeenCalledTimes(4)
    const [appendUrl, appendOptions] = fakeFetch.mock.calls[3] as [string, RequestInit]
    expect(appendUrl).toBe(env.APPS_SCRIPT_URL)
    const body = JSON.parse(String(appendOptions.body)) as Record<string, unknown>
    expect(body.bridgeToken).toBe(env.APPS_SCRIPT_BRIDGE_TOKEN)
    expect(body.privacyConsent).toBe(true)
    expect(body.orderId).toBe(result.orderId)
    expect(body.customerName).toBe(validOrder.customerName)
    expect(body.note).toBe(validOrder.note)
    expect(body.items).toEqual([{ productId: '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', name: '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', size: 'half', quantity: 2, unitPrice: 350 }])
    expect(body.total).toBe(760)
    expect(JSON.stringify(result)).not.toContain(validOrder.phone)
  })
})
