import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('./OrderBridge.gs', import.meta.url), 'utf8') + '\nthis.formatOrderItemsSummary = formatOrderItemsSummary_; this.buildOrderNotificationBody = buildOrderNotificationBody_; this.sendOrderNotification = sendOrderNotification_; this.orderNotificationEmail = ORDER_NOTIFICATION_EMAIL;'
const context = {}
vm.runInNewContext(source, context)

test('formats each order item as a readable product, size, quantity and price line', () => {
  const summary = context.formatOrderItemsSummary([
    { name: '衣索比亞 古吉', size: 'half', quantity: 2, unitPrice: 350 },
    { name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580 },
  ])
  assert.equal(summary, '【衣索比亞 古吉】半磅 × 2｜單價 NT$350｜小計 NT$700\n【肯亞 AA】一磅 × 1｜單價 NT$580｜小計 NT$580')
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
    items: [{ name: '衣索比亞 古吉', size: 'half', quantity: 2, unitPrice: 350 }],
    subtotal: 700,
    shipping: 60,
    total: 760,
  })
  assert.match(body, /QC-20261013-A1B2C3D4/)
  assert.match(body, /測試顧客/)
  assert.match(body, /0912345678/)
  assert.match(body, /7-ELEVEN 測試店 123456/)
  assert.match(body, /請先電話聯絡/)
  assert.match(body, /衣索比亞 古吉.*半磅 × 2.*NT\$350/)
  assert.match(body, /商品小計：NT\$700/)
  assert.match(body, /運費：NT\$60/)
  assert.match(body, /總額：NT\$760/)
  assert.doesNotMatch(body, /bridgeToken|ORDER_BRIDGE_TOKEN/)
})

test('sends the notification only to the configured owner inbox', () => {
  const order = {
    orderId: 'QC-20261013-A1B2C3D4', createdAt: '2026-10-13T09:30:00.000Z',
    customerName: '測試顧客', phone: '0912345678', deliveryMethod: 'pickup',
    storeInfo: '', note: '', items: [{ name: '肯亞 AA', size: 'one', quantity: 1, unitPrice: 580 }],
    subtotal: 580, shipping: 0, total: 580,
  }
  let message
  context.MailApp = { sendEmail: (payload) => { message = payload } }
  context.sendOrderNotification(order)
  assert.equal(message.to, 'prorockex@gmail.com')
  assert.match(message.subject, /QC-20261013-A1B2C3D4/)
  assert.match(message.body, /肯亞 AA/)
})

test('escapes spreadsheet formula-leading product names in the visible summary', () => {
  const summary = context.formatOrderItemsSummary([
    { name: '=HYPERLINK("https://example.invalid")', size: 'half', quantity: 1, unitPrice: 350 },
  ])
  assert.ok(summary.includes("【'=HYPERLINK"))
})

