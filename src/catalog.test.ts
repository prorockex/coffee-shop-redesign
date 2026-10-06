import { describe, expect, it } from 'vitest'
import { filterProducts, getCartTotal, products, canAddMore, getAvailableProducts, type CartLine } from './catalog'

const limitedId = 'colombia-huila-rainforest'

function line(productId: string, size: CartLine['size'], quantity: number): CartLine {
  return { productId, size, quantity }
}

describe('catalog data and order calculations', () => {
  it('contains the 27 listings from the supplied Products sheet without duplicate IDs', () => {
    expect(products).toHaveLength(27)
    expect(new Set(products.map((product) => product.id)).size).toBe(27)
  })

  it('preserves the source half-pound and one-pound prices', () => {
    const angelGeisha = products.find((product) => product.name === '衣索比亞 天使藝妓')
    expect(angelGeisha).toMatchObject({ priceHalf: 350, priceOne: 690 })
  })

  it('finds products by country, processing method, and tasting note', () => {
    expect(filterProducts(products, '肯亞').length).toBe(3)
    expect(filterProducts(products, '日曬').length).toBeGreaterThan(0)
    expect(filterProducts(products, '覆盆子').map((product) => product.id)).toContain('ethiopia-sidamo-flor-begonia')
  })

  it('computes totals from the selected bag size and quantity', () => {
    expect(getCartTotal([line('ethiopia-angel-geisha', 'half', 2)], products)).toBe(700)
    expect(getCartTotal([line('ethiopia-angel-geisha', 'one', 1)], products)).toBe(690)
  })

  it('blocks an item with an unverified stock note instead of promising availability', () => {
    const item = products.find((product) => product.id === limitedId)
    expect(item?.inventoryStatus).toBe('review')
    expect(canAddMore([], item!, 'half', 1)).toBe(false)
    expect(canAddMore([], item!, 'one', 1)).toBe(false)
  })

  it('shows only products whose Google Sheet ID cell is non-empty', () => {
    expect(getAvailableProducts().map((product) => product.id)).toEqual([
      'ethiopia-guji-uraga-tipoboka',
      'kenya-riyeri-queen-blackberry',
      'ethiopia-oromia-jimalim',
      'colombia-narino-floral-geisha',
      'ethiopia-bench-maji-sparrow-geisha',
      'ethiopia-bastet-geisha-2026',
    ])
    expect(getAvailableProducts()).toHaveLength(6)
  })

  it('does not allow sold-out products to be added to the cart', () => {
    const soldOut = products.find((product) => product.id === 'ethiopia-angel-geisha')!
    const stocked = products.find((product) => product.id === 'ethiopia-guji-uraga-tipoboka')!
    expect(canAddMore([], soldOut, 'half')).toBe(false)
    expect(canAddMore([], stocked, 'half')).toBe(true)
  })

  it('replaces the snapshot with the latest server-provided stock IDs', () => {
    expect(getAvailableProducts(products, ['p022']).map((product) => product.id)).toEqual([
      'ethiopia-guji-uraga-tipoboka',
    ])
    const removedFromSheet = products.find((product) => product.id === 'kenya-riyeri-queen-blackberry')!
    expect(canAddMore([], removedFromSheet, 'half', 1, ['p022'])).toBe(false)
  })
})
