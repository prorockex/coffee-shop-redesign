export type StockSyncState = 'snapshot' | 'live' | 'stale'

export function stockSyncLabel(state: StockSyncState): string {
  if (state === 'live') return '現貨已與 Google 試算表同步，每 30 秒檢查一次。'
  if (state === 'stale') return '同步暫時中斷，沿用最近一次成功的庫存資料。'
  return '尚未連接即時同步，目前使用已讀取的庫存快照。'
}

export interface StockFeed {
  stockCodes: string[]
  checkedAt: string
}

export function parseStockFeed(payload: unknown): StockFeed {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Invalid stock feed response')
  }

  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.stockCodes) || !record.stockCodes.every((code) => typeof code === 'string')) {
    throw new TypeError('Invalid stock code list')
  }
  if (typeof record.checkedAt !== 'string' || !Number.isFinite(Date.parse(record.checkedAt))) {
    throw new TypeError('Invalid stock feed timestamp')
  }

  return {
    stockCodes: [...new Set(record.stockCodes.map((code) => code.trim()).filter(Boolean))],
    checkedAt: record.checkedAt,
  }
}
