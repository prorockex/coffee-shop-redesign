// 「老邱自家烘焙 gemini」試算表的 Orders 分頁（與舊網站歷史訂單同一張表）。
const ORDER_BRIDGE_SHEET_ID = '1BxRlCcvVjLYEdhyIt2B7969k2i-kXKfwvviPFhLUi_g';
const ORDER_BRIDGE_SHEET_TAB = 'Orders';
const ORDER_BRIDGE_TOKEN_PROPERTY = 'ORDER_BRIDGE_TOKEN';
const ORDER_NOTIFICATION_EMAIL = 'prorockex@gmail.com';

/** Apps Script Web App POST receiver. Deploy as execute-as-owner, access-anyone. */
function doPost(e) {
  let lock;
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const expectedToken = PropertiesService.getScriptProperties().getProperty(ORDER_BRIDGE_TOKEN_PROPERTY);
    if (!expectedToken || !constantTimeEqual_(String(payload.bridgeToken || ''), expectedToken)) {
      return orderBridgeJson_({ status: 'error', error: 'unauthorized' });
    }

    const order = validateOrderBridgePayload_(payload);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return orderBridgeJson_({ status: 'error', error: 'busy' });

    const sheet = SpreadsheetApp.openById(ORDER_BRIDGE_SHEET_ID).getSheetByName(ORDER_BRIDGE_SHEET_TAB);
    if (!sheet) throw new Error('Orders tab not found');
    // Orders has no header row: row 1 is already an order, so search whenever any row exists.
    if (sheet.getLastRow() > 0 && sheet.createTextFinder(order.orderId).matchEntireCell(true).findNext()) {
      return orderBridgeJson_({ status: 'success', orderId: order.orderId, duplicate: true });
    }

    sheet.appendRow(buildOrderSheetRow_(order));
    const row = sheet.getLastRow();
    sheet.getRange(row, 2).setNumberFormat('yyyy/mm/dd h:mm:ss');
    if (String(sheet.getRange(row, 1).getValue()) !== order.orderId) throw new Error('Order row verification failed');
    let notification = 'sent';
    try {
      sendOrderNotification_(order);
    } catch (notificationError) {
      notification = 'failed';
      console.error('Order saved but owner email notification failed: ' + (notificationError && notificationError.message ? notificationError.message : 'unknown error'));
    }
    return orderBridgeJson_({ status: 'success', orderId: order.orderId, notification: notification });
  } catch (error) {
    console.error('Order bridge failed: ' + (error && error.message ? error.message : 'unknown error'));
    return orderBridgeJson_({ status: 'error', error: 'order_write_failed' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

/** Run only through clasp or the private Apps Script editor, never from the public page. */
function getOrCreateOrderBridgeToken_() {
  const properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty(ORDER_BRIDGE_TOKEN_PROPERTY);
  if (!token) {
    token = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('-');
    properties.setProperty(ORDER_BRIDGE_TOKEN_PROPERTY, token);
  }
  return token;
}

function validateOrderBridgePayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid order');
  const orderId = String(payload.orderId || '');
  const customerName = String(payload.customerName || '').trim();
  const phone = String(payload.phone || '').trim();
  const deliveryMethod = String(payload.deliveryMethod || '');
  const storeInfo = String(payload.storeInfo || '').trim();
  const note = String(payload.note || '').trim();
  const createdAt = String(payload.createdAt || '');
  const items = payload.items;
  const subtotal = Number(payload.subtotal);
  const shipping = Number(payload.shipping);
  const total = Number(payload.total);

  if (!/^QC-\d{8}-[A-F0-9]{8}$/.test(orderId)) throw new Error('Invalid order id');
  if (!customerName || customerName.length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(customerName)) throw new Error('Invalid name');
  if (!/^[0-9+()\-\s]{8,20}$/.test(phone)) throw new Error('Invalid phone');
  if (deliveryMethod !== 'pickup' && deliveryMethod !== 'convenience_store') throw new Error('Invalid fulfillment method');
  if (deliveryMethod === 'convenience_store' && (!storeInfo || storeInfo.length > 200)) throw new Error('Store required');
  if (deliveryMethod === 'pickup' && storeInfo.length > 200) throw new Error('Invalid store info');
  if (note.length > 500 || /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/.test(note)) throw new Error('Invalid note');
  if (payload.privacyConsent !== true || payload.retentionPolicy !== 'v1-90days') throw new Error('Consent required');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(createdAt) || isNaN(new Date(createdAt).getTime())) throw new Error('Invalid timestamp');
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new Error('Invalid items');

  let calculatedSubtotal = 0;
  const cleanItems = items.map(function(item) {
    if (!item || typeof item !== 'object') throw new Error('Invalid item');
    const productId = String(item.productId || '');
    const name = String(item.name || '').trim();
    const size = String(item.size || '');
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!/^[a-z0-9-]{1,80}$/.test(productId) || !name || name.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) throw new Error('Invalid product');
    if (size !== 'half' && size !== 'one') throw new Error('Invalid size');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Invalid quantity');
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || unitPrice > 1000000) throw new Error('Invalid price');
    const roastLevel = assertRoastLevel_(item.roastLevel);
    calculatedSubtotal += quantity * unitPrice;
    return { productId: productId, name: safeOrderCell_(name), size: size, quantity: quantity, unitPrice: unitPrice, roastLevel: roastLevel };
  });
  const expectedShipping = deliveryMethod === 'convenience_store' ? 60 : 0;
  if (subtotal !== calculatedSubtotal || shipping !== expectedShipping || total !== subtotal + shipping) throw new Error('Invalid total');

  return { orderId: orderId, customerName: customerName, phone: phone, deliveryMethod: deliveryMethod, storeInfo: storeInfo, note: note, createdAt: createdAt, items: cleanItems, subtotal: subtotal, shipping: shipping, total: total };
}

function buildOrderNotificationBody_(order) {
  const delivery = order.deliveryMethod === 'pickup' ? '店面自取' : '超商取貨';
  const lines = [
    '老邱自家烘焙收到新訂單',
    '',
    '訂單編號：' + order.orderId,
    '下單時間：' + order.createdAt,
    '顧客姓名：' + order.customerName,
    '聯絡電話：' + order.phone,
    '配送方式：' + delivery,
  ];
  if (order.storeInfo) lines.push('超商門市：' + order.storeInfo);
  lines.push('', '商品明細：', formatOrderItemsSummary_(order.items), '',
    '商品小計：NT$' + order.subtotal,
    '運費：NT$' + order.shipping,
    '總額：NT$' + order.total,
    '', '顧客備註：' + (order.note || '（無）'));
  return lines.join('\n');
}

function sendOrderNotification_(order) {
  MailApp.sendEmail({
    to: ORDER_NOTIFICATION_EMAIL,
    subject: '新咖啡訂單 ' + order.orderId + '｜老邱自家烘焙',
    body: buildOrderNotificationBody_(order),
    name: '老邱自家烘焙 訂單通知'
  });
}

/** 在 Apps Script 編輯器手動執行：觸發寄信權限授權，並寄一封測試信到 ORDER_NOTIFICATION_EMAIL。不會寫入試算表。 */
function testOrderEmail() {
  sendOrderNotification_({
    orderId: 'TEST-' + new Date().getTime(),
    createdAt: new Date().toISOString(),
    customerName: '測試顧客（非真實訂單）',
    phone: '0900000000',
    deliveryMethod: 'pickup',
    storeInfo: '',
    items: [{ name: '測試咖啡豆', size: 'half', quantity: 1, unitPrice: 1, roastLevel: '中焙' }],
    subtotal: 1,
    shipping: 0,
    total: 1,
    note: '這是 testOrderEmail 寄出的測試信'
  });
  console.log('Test email sent to ' + ORDER_NOTIFICATION_EMAIL);
}

/**
 * One row in the Orders tab, matching the historical rows (8 columns, A–H, no header):
 * A 訂單編號 | B 下單時間 | C 姓名 | D 電話 | E 取貨方式（自取／超商取貨） | F 品項 | G 總額（含運費） | H 備註／超商門市
 */
function buildOrderSheetRow_(order) {
  return [
    order.orderId,
    new Date(order.createdAt),
    safeOrderCell_(order.customerName),
    "'" + order.phone,
    order.deliveryMethod === 'convenience_store' ? '超商取貨' : '自取',
    formatOrderItemsForSheet_(order.items),
    order.total,
    formatOrderSheetNote_(order)
  ];
}

/** Items in the historical Orders format: 【品名】 烘焙度 / 規格 x數量, one line per item. */
function formatOrderItemsForSheet_(items) {
  return items.map(function(item) {
    const sizeLabel = item.size === 'half' ? '半磅' : '一磅';
    return '【' + safeOrderCell_(item.name) + '】 ' + assertRoastLevel_(item.roastLevel) + ' / ' + sizeLabel + ' x' + Number(item.quantity);
  }).join('\n');
}

/** Column H: store info for 超商取貨 (as the old site did), plus the customer note. */
function formatOrderSheetNote_(order) {
  const parts = [];
  if (order.storeInfo) parts.push(order.storeInfo);
  if (order.note) parts.push(order.storeInfo ? '備註：' + order.note : order.note);
  return safeOrderCell_(parts.join('\n'));
}

function assertRoastLevel_(value) {
  const roastLevel = String(value || '');
  if (roastLevel !== '淺焙' && roastLevel !== '中焙' && roastLevel !== '深焙') throw new Error('Invalid roast');
  return roastLevel;
}

function formatOrderItemsSummary_(items) {
  return items.map(function(item) {
    const sizeLabel = item.size === 'half' ? '半磅' : '一磅';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const roastLevel = assertRoastLevel_(item.roastLevel);
    const itemTotal = quantity * unitPrice;
    return '【' + safeOrderCell_(item.name) + '】' + sizeLabel + ' × ' + quantity + '｜' + roastLevel + '｜單價 NT$' + unitPrice + '｜小計 NT$' + itemTotal;
  }).join('\n');
}

function safeOrderCell_(value) {
  const text = String(value || '');
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function orderBridgeJson_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
