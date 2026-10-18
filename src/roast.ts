import { isRoastLevel, type CartLine, type RoastLevel } from './catalog'

export function lineMatchKey(line: Pick<CartLine, 'productId' | 'size' | 'roastLevel'>): string {
  return `${line.productId}|${line.size}|${line.roastLevel}`
}

export function upsertCartLine(lines: readonly CartLine[], addition: CartLine): CartLine[] {
  if (!isRoastLevel(addition.roastLevel)) return [...lines]
  const key = lineMatchKey(addition)
  if (!lines.some((line) => lineMatchKey(line) === key)) return [...lines, addition]
  return lines.map((line) => lineMatchKey(line) === key ? { ...line, quantity: line.quantity + addition.quantity } : line)
}

export function changeLineQuantity(lines: readonly CartLine[], target: CartLine, delta: number): CartLine[] {
  const key = lineMatchKey(target)
  return lines.flatMap((line) => {
    if (lineMatchKey(line) !== key) return [line]
    const quantity = line.quantity + delta
    return quantity > 0 ? [{ ...line, quantity }] : []
  })
}

export function retargetCartLine(lines: readonly CartLine[], target: CartLine, roastLevel: RoastLevel): CartLine[] {
  if (!isRoastLevel(roastLevel) || target.roastLevel === roastLevel) return [...lines]
  const key = lineMatchKey(target)
  const updated: CartLine = { ...target, roastLevel }
  const nextKey = lineMatchKey(updated)
  const collision = lines.some((line) => lineMatchKey(line) === nextKey)
  return lines.flatMap((line) => {
    if (lineMatchKey(line) === key) return collision ? [] : [updated]
    if (collision && lineMatchKey(line) === nextKey) return [{ ...line, quantity: line.quantity + target.quantity }]
    return [line]
  })
}
