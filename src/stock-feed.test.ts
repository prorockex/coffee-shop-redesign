import { describe, expect, it } from 'vitest'
import { parseStockFeed, stockSyncLabel } from './stock-feed'

describe('stock feed payload', () => {
  it('trims and deduplicates stock IDs from the server response', () => {
    expect(parseStockFeed({ stockCodes: [' p022 ', '', 'p023', 'p022'], checkedAt: '2026-10-06T00:00:00.000Z' })).toEqual({
      stockCodes: ['p022', 'p023'],
      checkedAt: '2026-10-06T00:00:00.000Z',
    })
  })

  it('rejects malformed responses instead of treating them as an empty stock list', () => {
    expect(() => parseStockFeed({ stockCodes: ['p022', null] })).toThrow()
    expect(() => parseStockFeed({ stockCodes: 'p022' })).toThrow()
  })

  it('labels live, stale, and snapshot inventory states honestly', () => {
    expect(stockSyncLabel('live')).toContain('已與 Google 試算表同步')
    expect(stockSyncLabel('stale')).toContain('沿用最近一次成功')
    expect(stockSyncLabel('snapshot')).toContain('尚未連接即時同步')
  })
})
