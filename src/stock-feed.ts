import type { Product } from './catalog'
import { isProduct } from './sheet-products'

export type StockSyncState = 'loading' | 'live' | 'stale' | 'error'

export function stockSyncLabel(state: StockSyncState): string {
  if (state === 'live') return '現貨已與 Google 試算表同步，每 30 秒檢查一次。'
  if (state === 'stale') return '同步暫時中斷，沿用最近一次成功的豆單。'
  if (state === 'error') return '暫時無法讀取豆單，請稍後重新整理或直接聯絡老邱。'
  return '正在讀取本期豆單…'
}

export interface StockFeed {
  products: Product[]
  checkedAt: string
}

export function parseStockFeed(payload: unknown): StockFeed {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Invalid stock feed response')
  }

  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.products) || !record.products.every(isProduct)) {
    throw new TypeError('Invalid product list')
  }
  if (typeof record.checkedAt !== 'string' || !Number.isFinite(Date.parse(record.checkedAt))) {
    throw new TypeError('Invalid stock feed timestamp')
  }

  return {
    products: record.products as Product[],
    checkedAt: record.checkedAt,
  }
}
