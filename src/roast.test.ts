import { describe, expect, it } from 'vitest'
import { isRoastLevel, type CartLine, type RoastLevel } from './catalog'
import { changeLineQuantity, lineMatchKey, retargetCartLine, upsertCartLine } from './roast'

function line(roastLevel: RoastLevel, quantity = 1, size: CartLine['size'] = 'half', productId = 'ethiopia-angel-geisha'): CartLine {
  return { productId, size, quantity, roastLevel }
}

describe('roast levels on cart lines', () => {
  it('accepts only 淺焙, 中焙, and 深焙', () => {
    expect(isRoastLevel('淺焙')).toBe(true)
    expect(isRoastLevel('中焙')).toBe(true)
    expect(isRoastLevel('深焙')).toBe(true)
    expect(isRoastLevel('light')).toBe(false)
    expect(isRoastLevel('中深焙')).toBe(false)
    expect(isRoastLevel('')).toBe(false)
    expect(isRoastLevel(null)).toBe(false)
  })

  it('keeps the same bean at different roast levels as separate lines', () => {
    const cart = upsertCartLine(upsertCartLine([], line('淺焙')), line('深焙', 2))
    expect(cart).toEqual([line('淺焙'), line('深焙', 2)])
    expect(lineMatchKey(cart[0])).not.toBe(lineMatchKey(cart[1]))
  })

  it('merges a repeated roast and still separates bag sizes', () => {
    const merged = upsertCartLine(upsertCartLine([], line('中焙')), line('中焙', 2))
    expect(merged).toEqual([line('中焙', 3)])
    const withOnePound = upsertCartLine(merged, line('中焙', 1, 'one'))
    expect(withOnePound).toEqual([line('中焙', 3), line('中焙', 1, 'one')])
  })

  it('edits a line onto another roast and combines quantities when that line already exists', () => {
    const cart = [line('淺焙', 1), line('深焙', 2)]
    expect(retargetCartLine(cart, cart[0], '深焙')).toEqual([line('深焙', 3)])
    expect(retargetCartLine(cart, cart[1], '中焙')).toEqual([line('淺焙', 1), line('中焙', 2)])
    expect(changeLineQuantity(retargetCartLine(cart, cart[0], '中焙'), line('中焙'), -1)).toEqual([line('深焙', 2)])
  })
})
