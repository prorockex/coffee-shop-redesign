import { describe, expect, it } from 'vitest'
import { isValidPhone, normalizePhone } from './phone'

describe('phone normalization', () => {
  it('accepts full-width digits, dashes, parentheses and spaces from Chinese IMEs', () => {
    expect(normalizePhone('０９１２－３４５６７８')).toBe('0912345678')
    expect(normalizePhone('（０７）１２３－４５６７')).toBe('071234567')
    expect(normalizePhone('0912\u3000345\u2014678')).toBe('0912345678')
    expect(normalizePhone('+886 912-345-678')).toBe('+886912345678')
    expect(isValidPhone(normalizePhone('０９１２３４５６７８'))).toBe(true)
  })
  it('rejects too short or non-numeric phones', () => {
    expect(isValidPhone(normalizePhone('1234567'))).toBe(false)
    expect(isValidPhone(normalizePhone('09abc12345'))).toBe(false)
  })
})
