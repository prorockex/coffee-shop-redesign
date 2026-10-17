import { describe, expect, it } from 'vitest'
import type { CartLine } from './catalog'
import { changeLineQuantity, fulfillmentSummary, lineMatchKey, retargetCartLine, roastShipEstimate, upsertCartLine } from './roast-to-order'

function line(partial: Partial<CartLine> & Pick<CartLine, 'productId' | 'size' | 'quantity'>): CartLine {
  return partial
}

describe('roast-to-order cart lines', () => {
  it('keeps stock and roast-to-order bags of the same coffee as separate lines', () => {
    const stock = line({ productId: 'ethiopia-angel-geisha', size: 'half', quantity: 1, fulfillment: 'stock' })
    const roasted = line({ productId: 'ethiopia-angel-geisha', size: 'half', quantity: 1, fulfillment: 'roast-to-order', roastLevel: 'light' })
    const cart = upsertCartLine(upsertCartLine([], stock), roasted)
    expect(cart).toHaveLength(2)
    expect(lineMatchKey(cart[0])).not.toBe(lineMatchKey(cart[1]))
    expect(fulfillmentSummary(cart[1])).toBe('現點現烘・淺焙')
  })

  it('merges a repeated roast level and can retarget onto an existing line', () => {
    const light = line({ productId: 'kenya-aa-faq', size: 'one', quantity: 1, fulfillment: 'roast-to-order', roastLevel: 'light' })
    const dark = line({ productId: 'kenya-aa-faq', size: 'one', quantity: 2, fulfillment: 'roast-to-order', roastLevel: 'dark' })
    const cart = upsertCartLine(upsertCartLine([], light), dark)
    const merged = retargetCartLine(cart, dark, 'roast-to-order', 'light')
    expect(merged).toEqual([{ productId: 'kenya-aa-faq', size: 'one', quantity: 3, fulfillment: 'roast-to-order', roastLevel: 'light' }])
    expect(changeLineQuantity(merged, merged[0], -3)).toEqual([])
  })

  it('estimates a 1–2 day roast window after the order date, then shipping', () => {
    expect(roastShipEstimate(new Date(2026, 9, 17))).toBe('預計 10月18日至10月19日完成烘焙，再安排出貨。')
    expect(roastShipEstimate(new Date(2026, 0, 31))).toBe('預計 2月1日至2月2日完成烘焙，再安排出貨。')
  })
})