import { describe, expect, it, vi } from 'vitest'
import { submitOrder, type OrderSubmission } from './order-client'

const order: OrderSubmission = {
  customerName: '測試朋友',
  phone: '0912345678',
  deliveryMethod: 'pickup',
  storeInfo: '',
  note: '',
  items: [{ productId: 'ethiopia-guji-uraga-tipoboka', size: 'half', quantity: 1, roastLevel: '深焙' }],
  privacyConsent: true,
  turnstileToken: 'turnstile-token',
  website: '',
}

describe('Apps Script-backed order client', () => {
  it('posts only the customer selections and consent to the same-origin order endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ orderId: 'QC-20261006-A1B2C3D4', subtotal: 350, shipping: 0, total: 350, currency: 'TWD', ownerNotified: true }), { status: 201 }))
    const result = await submitOrder(order, fetcher)
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/orders')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({ 'content-type': 'application/json' })
    const payload = JSON.parse(String(options.body)) as Record<string, unknown>
    expect(payload).toMatchObject({ customerName: order.customerName, phone: order.phone, privacyConsent: true })
    expect(payload.items).toEqual(order.items)
    expect(payload).not.toHaveProperty('total')
    expect(payload).not.toHaveProperty('bridgeToken')
    expect(result.total).toBe(350)
  })

  it('returns a readable error for a rejected order and never reports success', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '商品已售完' }), { status: 409 }))
    await expect(submitOrder(order, fetcher)).rejects.toThrow('商品已售完')
  })
})
