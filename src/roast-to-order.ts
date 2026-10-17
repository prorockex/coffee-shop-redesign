import type { CartLine } from './catalog'

export const ROAST_LEVELS = [
  { id: 'light', label: '淺焙' },
  { id: 'medium', label: '中焙' },
  { id: 'dark', label: '深焙' },
] as const

export type RoastLevel = (typeof ROAST_LEVELS)[number]['id']
export type BeanFulfillment = 'stock' | 'roast-to-order'

export function isRoastLevel(value: unknown): value is RoastLevel {
  return ROAST_LEVELS.some((level) => level.id === value)
}

export function roastLevelLabel(level: RoastLevel): string {
  return ROAST_LEVELS.find((item) => item.id === level)?.label ?? '中焙'
}

export function lineFulfillment(line: Pick<CartLine, 'fulfillment'>): BeanFulfillment {
  return line.fulfillment === 'roast-to-order' ? 'roast-to-order' : 'stock'
}

export function lineMatchKey(line: Pick<CartLine, 'productId' | 'size' | 'fulfillment' | 'roastLevel'>): string {
  const fulfillment = lineFulfillment(line)
  const roast = fulfillment === 'roast-to-order' && isRoastLevel(line.roastLevel) ? line.roastLevel : ''
  return `${line.productId}|${line.size}|${fulfillment}|${roast}`
}

export function withFulfillment(line: CartLine, fulfillment: BeanFulfillment, roastLevel?: RoastLevel | null): CartLine {
  if (fulfillment === 'roast-to-order') {
    const level = isRoastLevel(roastLevel) ? roastLevel : isRoastLevel(line.roastLevel) ? line.roastLevel : 'medium'
    return { productId: line.productId, size: line.size, quantity: line.quantity, fulfillment: 'roast-to-order', roastLevel: level }
  }
  return { productId: line.productId, size: line.size, quantity: line.quantity, fulfillment: 'stock' }
}

export function fulfillmentSummary(line: Pick<CartLine, 'fulfillment' | 'roastLevel'>): string {
  if (lineFulfillment(line) === 'roast-to-order' && isRoastLevel(line.roastLevel)) return `現點現烘・${roastLevelLabel(line.roastLevel)}`
  return '現貨'
}

export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

/** Illustrative window: roast finishes 1–2 days after ordering, then the shop ships. */
export function roastShipRange(now = new Date()): string {
  const start = formatMonthDay(addCalendarDays(now, 1))
  const end = formatMonthDay(addCalendarDays(now, 2))
  return `${start}至${end}`
}

export function roastShipEstimate(now = new Date()): string {
  return `預計 ${roastShipRange(now)}完成烘焙，再安排出貨。`
}

export const ROAST_FRESH_NOTE = '下單後才為你烘焙這批豆子。預計 1–2 天內完成烘焙，再安排出貨。'

export function upsertCartLine(lines: readonly CartLine[], addition: CartLine): CartLine[] {
  const next = withFulfillment(addition, lineFulfillment(addition), addition.roastLevel)
  const key = lineMatchKey(next)
  if (!lines.some((line) => lineMatchKey(line) === key)) return [...lines, next]
  return lines.map((line) => lineMatchKey(line) === key ? { ...line, quantity: line.quantity + next.quantity } : line)
}

export function changeLineQuantity(lines: readonly CartLine[], target: CartLine, delta: number): CartLine[] {
  const key = lineMatchKey(target)
  return lines.flatMap((line) => {
    if (lineMatchKey(line) !== key) return [line]
    const quantity = line.quantity + delta
    return quantity > 0 ? [{ ...line, quantity }] : []
  })
}

export function retargetCartLine(lines: readonly CartLine[], target: CartLine, fulfillment: BeanFulfillment, roastLevel?: RoastLevel | null): CartLine[] {
  const key = lineMatchKey(target)
  const updated = withFulfillment(target, fulfillment, roastLevel)
  const nextKey = lineMatchKey(updated)
  const collision = key !== nextKey && lines.some((line) => lineMatchKey(line) === nextKey)
  return lines.flatMap((line) => {
    if (lineMatchKey(line) === key) return collision ? [] : [updated]
    if (collision && lineMatchKey(line) === nextKey) return [{ ...line, quantity: line.quantity + target.quantity }]
    return [line]
  })
}
