import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('./OrderBridge.gs', import.meta.url), 'utf8') + '\nthis.formatOrderItemsSummary = formatOrderItemsSummary_; this.buildOrderNotificationBody = buildOrderNotificationBody_; this.sendOrderNotification = sendOrderNotification_; this.orderNotificationEmail = ORDER_NOTIFICATION_EMAIL; this.buildOrderSheetRow = buildOrderSheetRow_; this.formatOrderItemsForSheet = formatOrderItemsForSheet_; this.sheetId = ORDER_BRIDGE_SHEET_ID; this.sheetTab = ORDER_BRIDGE_SHEET_TAB;'
const context = {}
vm.runInNewContext(source, context)

test('formats each order item with its roast, size, quantity and price', () => {
  const summary = context.formatOrderItemsSummary([
    { name: '衣索比亞 古吉', size: 'half', quantity: 2, unitPrice: 350, roastLevel: '淺焙' },
    { name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580, roastLevel: '深焙' },
  ])
  assert.equal(summary, '【衣索比亞 古吉】半磅 × 2｜淺焙｜單價 NT$350｜小計 NT$700\n【肯亞 AA】一磅 × 1｜深焙｜單價 NT$580｜小計 NT$580')
})

test('refuses a summary line when roast is missing or not one of the three levels', () => {
  assert.throws(() => context.formatOrderItemsSummary([
    { name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580 },
  ]), /Invalid roast/)
  assert.throws(() => context.formatOrderItemsSummary([
    { name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580, roastLevel: 'light' },
  ]), /Invalid roast/)
})

test('builds an owner notification with order details and no bridge credential', () => {
  const body = context.buildOrderNotificationBody({
    orderId: 'QC-20261013-A1B2C3D4',
    createdAt: '2026-10-13T09:30:00.000Z',
    customerName: '測試顧客',
    phone: '0912345678',
    deliveryMethod: 'convenience_store',
    storeInfo: '7-ELEVEN 測試店 123456',
    note: '請先電話聯絡',
    items: [{ name: '衣索比亞 古吉', size: 'half', quantity: 2, unitPrice: 350, roastLevel: '淺焙' }],
    subtotal: 700,
    shipping: 60,
    total: 760,
  })
  assert.match(body, /QC-20261013-A1B2C3D4/)
  assert.match(body, /測試顧客/)
  assert.match(body, /0912345678/)
  assert.match(body, /7-ELEVEN 測試店 123456/)
  assert.match(body, /請先電話聯絡/)
  assert.match(body, /衣索比亞 古吉.*半磅 × 2.*淺焙.*NT\$350/)
  assert.match(body, /商品小計：NT\$700/)
  assert.match(body, /運費：NT\$60/)
  assert.match(body, /總額：NT\$760/)
  assert.doesNotMatch(body, /bridgeToken|ORDER_BRIDGE_TOKEN/)
})

test('sends the notification only to the configured owner inbox', () => {
  const order = {
    orderId: 'QC-20261013-A1B2C3D4', createdAt: '2026-10-13T09:30:00.000Z',
    customerName: '測試顧客', phone: '0912345678', deliveryMethod: 'pickup',
    storeInfo: '', note: '', items: [{ name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580, roastLevel: '中焙' }],
    subtotal: 580, shipping: 0, total: 580,
  }
  let message
  context.MailApp = { sendEmail: (payload) => { message = payload } }
  context.sendOrderNotification(order)
  assert.equal(message.to, 'prorockex@gmail.com')
  assert.match(message.subject, /QC-20261013-A1B2C3D4/)
  assert.match(message.body, /肯亞 AA/)
  assert.match(message.body, /中焙/)
})

test('escapes spreadsheet formula-leading product names in the visible summary', () => {
  const summary = context.formatOrderItemsSummary([
    { name: '=HYPERLINK("https://example.invalid")', size: 'half', quantity: 1, unitPrice: 350, roastLevel: '淺焙' },
  ])
  assert.ok(summary.includes("【'=HYPERLINK"))
})


test('targets the Orders tab of the 老邱自家烘焙 gemini spreadsheet', () => {
  assert.equal(context.sheetId, '1BxRlCcvVjLYEdhyIt2B7969k2i-kXKfwvviPFhLUi_g')
  assert.equal(context.sheetTab, 'Orders')
})

test('formats sheet items like the historical Orders rows', () => {
  assert.equal(context.formatOrderItemsForSheet([
    { name: '衣索比亞 金寶藝妓 水洗', size: 'half', quantity: 1, unitPrice: 350, roastLevel: '淺焙' },
    { name: '衣索比亞 古吉 罕貝拉 貝德莎處理廠', size: 'one', quantity: 2, unitPrice: 690, roastLevel: '中焙' },
  ]), '【衣索比亞 金寶藝妓 水洗】 淺焙 / 半磅 x1\n【衣索比亞 古吉 罕貝拉 貝德莎處理廠】 中焙 / 一磅 x2')
  assert.throws(() => context.formatOrderItemsForSheet([{ name: 'x', size: 'half', quantity: 1, unitPrice: 1 }]), /Invalid roast/)
})

test('builds an 8-column pickup row: id, time, name, phone, 自取, items, total, note', () => {
  const row = context.buildOrderSheetRow({
    orderId: 'QC-20261018-A1B2C3D4', createdAt: '2026-10-18T05:30:00.000Z',
    customerName: '測試顧客', phone: '0912345678', deliveryMethod: 'pickup', storeInfo: '', note: '下午來拿',
    items: [{ name: '哥倫比亞 娜玲瓏 花境 藝妓', size: 'half', quantity: 1, unitPrice: 380, roastLevel: '淺焙' }],
    subtotal: 380, shipping: 0, total: 380,
  })
  assert.equal(row.length, 8)
  assert.equal(row[0], 'QC-20261018-A1B2C3D4')
  assert.equal(row[1].toISOString(), '2026-10-18T05:30:00.000Z')
  assert.deepEqual([...row.slice(2)], ['測試顧客', "'0912345678", '自取', '【哥倫比亞 娜玲瓏 花境 藝妓】 淺焙 / 半磅 x1', 380, '下午來拿'])
})

test('convenience-store row puts the store in column H and total includes shipping', () => {
  const row = context.buildOrderSheetRow({
    orderId: 'QC-20261018-A1B2C3D4', createdAt: '2026-10-18T05:30:00.000Z',
    customerName: '測試顧客', phone: '0912345678', deliveryMethod: 'convenience_store', storeInfo: '7-11/243720/三民陽豐', note: '',
    items: [{ name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 700, roastLevel: '深焙' }],
    subtotal: 700, shipping: 60, total: 760,
  })
  assert.equal(row[4], '超商取貨')
  assert.equal(row[6], 760)
  assert.equal(row[7], '7-11/243720/三民陽豐')
  const withNote = context.buildOrderSheetRow({ ...{
    orderId: 'QC-20261018-A1B2C3D4', createdAt: '2026-10-18T05:30:00.000Z', customerName: 'a', phone: '0912345678',
    deliveryMethod: 'convenience_store', storeInfo: '全家 春風店', note: '請先來電',
    items: [{ name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 700, roastLevel: '深焙' }], subtotal: 700, shipping: 60, total: 760 } })
  assert.equal(withNote[7], '全家 春風店\n備註：請先來電')
})

test('escapes formula-leading names, notes and stores in the sheet row', () => {
  const row = context.buildOrderSheetRow({
    orderId: 'QC-20261018-A1B2C3D4', createdAt: '2026-10-18T05:30:00.000Z',
    customerName: '=cmd', phone: '0912345678', deliveryMethod: 'pickup', storeInfo: '', note: '+SUM(A1)',
    items: [{ name: '@x', size: 'half', quantity: 1, unitPrice: 350, roastLevel: '淺焙' }],
    subtotal: 350, shipping: 0, total: 350,
  })
  assert.equal(row[2], "'=cmd")
  assert.equal(row[7], "'+SUM(A1)")
  assert.equal(row[5], "【'@x】 淺焙 / 半磅 x1")
})
