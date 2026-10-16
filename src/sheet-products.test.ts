import { describe, expect, it } from 'vitest'
import { isListed, normalizeName, productsFromSheetRows } from './sheet-products'

describe('Products sheet → storefront products', () => {
  it('normalizes names (trim, collapse spaces, full-width slash)', () => {
    expect(normalizeName('  盧安達  如霖朵 天空之城 ')).toBe('盧安達 如霖朵 天空之城')
    expect(normalizeName('烏克栗栗／黑莓皇后')).toBe('烏克栗栗/黑莓皇后')
  })

  it('builds products from ticked rows only, with sheet fields and prices', () => {
    const rows = [
      ['P024', '衣索比亞 歐若米雅 吉瑪莉姆', '衣索比亞', '', '水洗', '白花清香', 350, 690, true],
      ['P001', '衣索比亞 天使藝妓', '衣索比亞', '藝妓', '水洗', '杏桃', 350, 690, false],
      ['', '全新豆子', '巴拿馬 ', ' 藝妓', '日曬', '莓果', '400', '780', 'TRUE'],
    ]
    expect(productsFromSheetRows(rows)).toEqual([
      { id: '衣索比亞 歐若米雅 吉瑪莉姆', name: '衣索比亞 歐若米雅 吉瑪莉姆', origin: '衣索比亞', process: '水洗', flavor: '白花清香', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
      { id: '全新豆子', name: '全新豆子', origin: '巴拿馬', bean: '藝妓', process: '日曬', flavor: '莓果', priceHalf: 400, priceOne: 780, inventoryStatus: 'listed' },
    ])
  })

  it('fills missing fields from the static catalog by name but never requires a match', () => {
    const [enriched] = productsFromSheetRows([['', '衣索比亞 天使藝妓', '', '', '', '', '', '', true]])
    expect(enriched).toMatchObject({ origin: '衣索比亞', bean: '藝妓', priceHalf: 350, priceOne: 690 })
    expect(productsFromSheetRows([['', '沒有價格的新豆', '', '', '', '', '', '', true]])).toEqual([])
  })

  it('skips nameless and duplicate rows', () => {
    const row = ['', '同名豆', 'x', '', '水洗', 'y', 1, 2, true]
    expect(productsFromSheetRows([row, row, ['', ' ', '', '', '', '', 1, 2, true]])).toHaveLength(1)
    expect(isListed(false)).toBe(false)
  })
})
