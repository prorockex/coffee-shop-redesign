import { products as staticCatalog, type Product } from './catalog'

// Products sheet columns (row 1 headers): A ID, B 名稱, C 產區, D 豆種, E 處理法, F 風味描述, G 半磅價格, H 一磅價格, I 上架.
// Listing is decided ONLY by column I (上架 checkbox). Column A is ignored.
export const SHEET_RANGE_COLUMNS = 'A2:I1000'
const COL = { name: 1, origin: 2, bean: 3, process: 4, flavor: 5, priceHalf: 6, priceOne: 7, listed: 8 } as const

export function isListed(value: unknown): boolean {
  if (value === true) return true
  return typeof value === 'string' && value.trim().toUpperCase() === 'TRUE'
}

export function normalizeName(value: string): string {
  return value.normalize('NFKC').replace(/／/g, '/').replace(/\s+/g, ' ').trim()
}

function text(value: unknown): string {
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function price(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

const staticByName = new Map(staticCatalog.map((product) => [normalizeName(product.name), product]))

/** Builds the storefront product list from Products sheet rows (A2:I). Only rows with column I TRUE are returned. */
export function productsFromSheetRows(rows: unknown, catalog: ReadonlyMap<string, Product> = staticByName): Product[] {
  if (!Array.isArray(rows)) return []
  const seen = new Set<string>()
  const result: Product[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || !isListed(row[COL.listed])) continue
    const name = normalizeName(text(row[COL.name]))
    if (!name || seen.has(name)) continue
    const fallback = catalog.get(name)
    const priceHalf = price(row[COL.priceHalf]) ?? fallback?.priceHalf
    const priceOne = price(row[COL.priceOne]) ?? fallback?.priceOne
    if (!priceHalf || !priceOne) continue
    seen.add(name)
    const bean = text(row[COL.bean]) || fallback?.bean
    result.push({
      id: name,
      name,
      origin: text(row[COL.origin]) || fallback?.origin || '',
      ...(bean ? { bean } : {}),
      process: text(row[COL.process]) || fallback?.process || '',
      flavor: text(row[COL.flavor]) || fallback?.flavor || '',
      priceHalf,
      priceOne,
      inventoryStatus: 'listed',
    })
  }
  return result
}

export function isProduct(value: unknown): value is Product {
  if (value === null || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.id === 'string' && !!p.id && typeof p.name === 'string' && typeof p.origin === 'string'
    && typeof p.process === 'string' && typeof p.flavor === 'string'
    && typeof p.priceHalf === 'number' && typeof p.priceOne === 'number'
    && (p.bean === undefined || typeof p.bean === 'string')
    && (p.inventoryStatus === 'listed' || p.inventoryStatus === 'review')
}
