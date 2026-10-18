import type { BagSize, RoastLevel } from './catalog'

export type OrderSubmission = {
  customerName: string
  phone: string
  deliveryMethod: 'pickup' | 'convenience_store'
  storeInfo: string
  note: string
  items: Array<{ productId: string; size: BagSize; quantity: number; roastLevel: RoastLevel }>
  privacyConsent: true
  turnstileToken: string
  website: string
}

export type OrderReceipt = {
  orderId: string
  subtotal: number
  shipping: number
  total: number
  currency: 'TWD'
  ownerNotified: boolean
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function submitOrder(order: OrderSubmission, fetcher: Fetcher = fetch): Promise<OrderReceipt> {
  const response = await fetcher('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(order),
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('訂單服務暫時無法使用，請稍後再試。')
  }

  const result = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : '訂單送出失敗，請稍後再試。')
  }
  if (
    typeof result.orderId !== 'string' ||
    !Number.isSafeInteger(result.subtotal) ||
    !Number.isSafeInteger(result.shipping) ||
    !Number.isSafeInteger(result.total) ||
    result.currency !== 'TWD' ||
    typeof result.ownerNotified !== 'boolean'
  ) throw new Error('訂單回覆格式不正確，請聯絡店家確認。')

  return result as OrderReceipt
}
