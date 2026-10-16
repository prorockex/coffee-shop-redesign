import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { bridgeProductId, onRequestPost, type Env } from './orders'

type Validator = (payload: unknown) => { items: Array<{ productId: string; name: string }> }
const gsSource = readFileSync(new URL('../../apps-script/OrderBridge.gs', import.meta.url), 'utf8')
const stub = new Proxy({}, { get: () => stub })
const sandbox: Record<string, unknown> = { SpreadsheetApp: stub, PropertiesService: stub, ContentService: stub, MailApp: stub, LockService: stub, Utilities: stub, Logger: stub, console }
runInNewContext(`${gsSource}\n;this.__validate = validateOrderBridgePayload_;`, sandbox)
const validate = sandbox.__validate as Validator

const env: Env = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'orders@example.iam.gserviceaccount.com', GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '', STOCK_SHEET_ID: 's', STOCK_SHEET_TAB: 'Products',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec', APPS_SCRIPT_BRIDGE_TOKEN: 't', TURNSTILE_SECRET: 'x', STOREFRONT_ORIGIN: 'https://coffee-shop-redesign.pages.dev',
}
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\\n${btoa(Array.from(der, (b) => String.fromCharCode(b)).join(''))}\\n-----END PRIVATE KEY-----`
})

const row = (name: string, half: number, one: number) => ['P0', name, '衣索比亞', '', '水洗', '花香', half, one, true]
const names = ['衣索比亞 歐若米雅 吉瑪莉姆', '哥倫比亞 娜玲瓏 花境 藝妓', '衣索比亞 班奇馬吉 飛雀 藝妓 紅圈計畫', '肯亞 冽里 烏克栗栗/黑莓皇后 PB TOP', '衣索比亞 古吉 烏拉嘎 提波波卡處理廠']

describe('Apps Script bridge payload compatibility', () => {
  it('derives ASCII-safe deterministic ids', async () => {
    for (const name of names) {
      const id = await bridgeProductId(name)
      expect(id).toMatch(/^[a-z0-9-]{1,80}$/)
      expect(await bridgeProductId(name)).toBe(id)
    }
    expect(await bridgeProductId(names[0])).not.toBe(await bridgeProductId(names[1]))
  })

  for (const deliveryMethod of ['pickup', 'convenience_store'] as const) {
    it(`sends a payload the real validateOrderBridgePayload_ accepts (${deliveryMethod})`, async () => {
      let payload: unknown
      const fakeFetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, hostname: 'coffee-shop-redesign.pages.dev', action: 'order' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'a' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ values: [row(names[0], 350, 690), row(names[1], 380, 750), row(names[2], 350, 690), row(names[3], 350, 690)] })))
        .mockImplementationOnce(async (_u, o) => { payload = JSON.parse(String((o as RequestInit).body)); return new Response(JSON.stringify({ status: 'success', orderId: (payload as { orderId: string }).orderId, notification: 'sent' })) })
      vi.stubGlobal('fetch', fakeFetch)
      const response = await onRequestPost({
        request: new Request('https://coffee-shop-redesign.pages.dev/api/orders', {
          method: 'POST', headers: { origin: env.STOREFRONT_ORIGIN!, 'content-type': 'application/json' },
          body: JSON.stringify({
            customerName: '邱 測試', phone: '0912-345 678', deliveryMethod, storeInfo: deliveryMethod === 'pickup' ? '' : '7-ELEVEN 測試門市 123456', note: '第一行\n第二行',
            items: [{ productId: names[0], size: 'half', quantity: 2 }, { productId: names[1], size: 'one', quantity: 1 }, { productId: names[3], size: 'half', quantity: 1 }],
            privacyConsent: true, turnstileToken: 'ok', website: '',
          }),
        }), env,
      })
      vi.unstubAllGlobals()
      expect(response.status).toBe(201)
      const clean = validate(payload)
      expect(clean.items.map((item) => item.name)).toEqual([names[0], names[1], names[3]])
      for (const item of clean.items) expect(item.productId).toMatch(/^[a-z0-9-]{1,80}$/)
    })
  }

  it('the real validator still rejects a raw Chinese product id (the production bug)', () => {
    expect(() => validate({ orderId: 'QC-20261016-ABCDEF12', customerName: 'a', phone: '0912345678', deliveryMethod: 'pickup', storeInfo: '', note: '', privacyConsent: true, retentionPolicy: 'v1-90days', createdAt: new Date().toISOString(), items: [{ productId: names[0], name: names[0], size: 'half', quantity: 1, unitPrice: 350 }], subtotal: 350, shipping: 0, total: 350 })).toThrow('Invalid product')
  })
})
