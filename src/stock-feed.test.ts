import { describe, expect, it } from 'vitest'
import { parseStockFeed, stockSyncLabel } from './stock-feed'

describe('stock feed payload', () => {
  const product = { id: '肯亞 AA FAQ', name: '肯亞 AA FAQ', origin: '肯亞', process: '水洗', flavor: '烏梅', priceHalf: 330, priceOne: 650, inventoryStatus: 'listed' }

  it('accepts a product list from the server response', () => {
    expect(parseStockFeed({ products: [product], checkedAt: '2026-10-06T00:00:00.000Z' })).toEqual({ products: [product], checkedAt: '2026-10-06T00:00:00.000Z' })
  })

  it('rejects malformed responses instead of treating them as an empty list', () => {
    expect(() => parseStockFeed({ products: [{ ...product, priceHalf: '330' }], checkedAt: '2026-10-06T00:00:00.000Z' })).toThrow()
    expect(() => parseStockFeed({ stockCodes: ['p022'], checkedAt: '2026-10-06T00:00:00.000Z' })).toThrow()
  })

  it('labels live, stale, and snapshot inventory states honestly', () => {
    expect(stockSyncLabel('live')).toContain('已與 Google 試算表同步')
    expect(stockSyncLabel('stale')).toContain('沿用最近一次成功')
    expect(stockSyncLabel('loading')).toContain('正在讀取')
    expect(stockSyncLabel('error')).toContain('暫時無法讀取')
    expect(stockSyncLabel('illustrative')).toContain('示意豆單')
  })
})
