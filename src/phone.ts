/** Normalize a phone typed with any IME (full-width digits, dashes, parentheses, spaces) to ASCII digits, optionally prefixed with '+'. */
export function normalizePhone(value: string): string {
  const ascii = value.normalize('NFKC').replace(/[\u2010-\u2015\u2212\u30fc\uff70]/g, '-')
  const plus = ascii.trim().startsWith('+') ? '+' : ''
  return plus + ascii.replace(/[\s\-().‧·]/g, '').replace(/^\+/, '')
}

export function isValidPhone(normalized: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(normalized)
}
