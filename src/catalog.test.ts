import { describe, expect, it } from 'vitest'
import { filterProducts, getCartTotal, products, canAddMore, type CartLine } from './catalog'

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

})
