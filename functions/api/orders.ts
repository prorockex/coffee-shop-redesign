import { isProductAvailable, products, priceFor, type BagSize, type CartLine } from '../../src/catalog'

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string
  STOCK_SHEET_ID?: string
  STOCK_SHEET_TAB?: string
  ORDER_SHEET_ID?: string
  APPS_SCRIPT_URL?: string
  APPS_SCRIPT_BRIDGE_TOKEN?: string
  TURNSTILE_SECRET?: string
  STOREFRONT_ORIGIN?: string
}
export interface PagesContext { request: Request; env: Env }
type SubmittedItem = CartLine
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const MAX_BODY = 16_000
const SHIPPING_FEE = 60

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}
function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function privateKeyDer(pemValue: string): ArrayBuffer {
  const pem = pemValue.replace(/\\n/g, '\n')
  const encoded = pem.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)?.[1]
  if (!encoded) throw new Error('Invalid service account key')
  const binary = atob(encoded.replace(/\s/g, ''))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
}
async function accessToken(email: string, privateKey: string, signal: AbortSignal): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ iss: email, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })))
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey('pkcs8', privateKeyDer(privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(new Uint8Array(signature))}` }), signal })
  if (!response.ok) throw new Error('Google token exchange failed')
  const body = await response.json() as { access_token?: unknown }
  if (typeof body.access_token !== 'string') throw new Error('Invalid Google token response')
  return body.access_token
}
function parseOrder(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const customerName = typeof data.customerName === 'string' ? data.customerName.trim() : ''
  const phone = typeof data.phone === 'string' ? data.phone.trim() : ''
  const deliveryMethod = data.deliveryMethod
  const storeInfo = typeof data.storeInfo === 'string' ? data.storeInfo.trim() : ''
  const note = typeof data.note === 'string' ? data.note.trim() : ''
  const turnstileToken = typeof data.turnstileToken === 'string' ? data.turnstileToken.trim() : ''
  const website = typeof data.website === 'string' ? data.website.trim() : ''
  if (customerName.length < 1 || customerName.length > 80 || Array.from(customerName).some((character) => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))) return null
  if (!/^[0-9+()\-\s]{8,20}$/.test(phone)) return null
  if (deliveryMethod !== 'convenience_store' && deliveryMethod !== 'pickup') return null
  if (deliveryMethod === 'convenience_store' && (!storeInfo || storeInfo.length > 200)) return null
  if (deliveryMethod === 'pickup' && storeInfo.length > 200) return null
  if (note.length > 500 || Array.from(note).some((character) => character.charCodeAt(0) < 9 || (character.charCodeAt(0) > 13 && character.charCodeAt(0) < 32) || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))) return null
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 30) return null
  const items: SubmittedItem[] = []
  for (const entry of data.items) {
    if (!entry || typeof entry !== 'object') return null
    const line = entry as Record<string, unknown>
    if (typeof line.productId !== 'string' || (line.size !== 'half' && line.size !== 'one') || !Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 20) return null
    items.push({ productId: line.productId, size: line.size as BagSize, quantity: Number(line.quantity) })
  }
  if (!turnstileToken || turnstileToken.length > 4096 || data.privacyConsent !== true) return null
  return { customerName, phone, deliveryMethod, storeInfo, note, items, turnstileToken, privacyConsent: true, website }
}

function isAppsScriptWebAppUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)
  } catch {
    return false
  }
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const origin = request.headers.get('origin')
  if (!env.STOREFRONT_ORIGIN || origin !== env.STOREFRONT_ORIGIN) return json({ error: '請從商店頁面送出訂單。' }, 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: '訂單資料格式不正確。' }, 415)
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json({ error: '訂單資料超過限制。' }, 413)
  let raw: unknown
  try { raw = await request.json() } catch { return json({ error: '訂單資料格式不正確。' }, 400) }
  const order = parseOrder(raw)
  if (!order) return json({ error: '請檢查姓名、電話、商品與個資同意欄位。' }, 400)
  if (order.website) return json({ ok: true }, 202)
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const stockSheetId = env.STOCK_SHEET_ID?.trim()
  const appScriptUrl = env.APPS_SCRIPT_URL?.trim()
  const bridgeToken = env.APPS_SCRIPT_BRIDGE_TOKEN?.trim()
  const turnstileSecret = env.TURNSTILE_SECRET?.trim()
  if (!email || !privateKey || !stockSheetId || !appScriptUrl || !isAppsScriptWebAppUrl(appScriptUrl) || !bridgeToken || !turnstileSecret) return json({ error: '訂單服務尚未完成設定，請聯絡店主。' }, 503)
  try {
    const verificationForm = new URLSearchParams({ secret: turnstileSecret, response: order.turnstileToken })
    const ip = request.headers.get('cf-connecting-ip')
    if (ip) verificationForm.set('remoteip', ip)
    const turnstileResponse = await fetch(TURNSTILE_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: verificationForm, signal: request.signal })
    const turnstile = await turnstileResponse.json() as { success?: boolean; hostname?: string; action?: string }
    if (!turnstileResponse.ok || !turnstile.success || turnstile.hostname !== new URL(env.STOREFRONT_ORIGIN).hostname || turnstile.action !== 'order') return json({ error: '驗證逾時，請重新完成驗證後送出。' }, 403)
    const token = await accessToken(email, privateKey, request.signal)
    const tab = (env.STOCK_SHEET_TAB?.trim() || 'Products').replace(/'/g, "''")
    const range = encodeURIComponent(`'${tab}'!A2:A1000`)
    const stockUrl = `${SHEETS_API}/${encodeURIComponent(stockSheetId)}/values/${range}?majorDimension=ROWS`
    const stockResponse = await fetch(stockUrl, { headers: { authorization: `Bearer ${token}` }, signal: request.signal })
    if (!stockResponse.ok) throw new Error('Inventory read failed')
    const sheet = await stockResponse.json() as { values?: unknown }
    const uniqueCodes = [...new Set(Array.isArray(sheet.values) ? sheet.values.flatMap((row) => Array.isArray(row) && (typeof row[0] === 'string' || typeof row[0] === 'number') && String(row[0]).trim() ? [String(row[0]).trim()] : []) : [])]
    let subtotal = 0
    const itemDetails: Array<{ productId: string; name: string; size: BagSize; quantity: number; unitPrice: number }> = []
    for (const line of order.items) {
      const product = products.find((item) => item.id === line.productId)
      if (!product || !isProductAvailable(product, uniqueCodes) || product.inventoryStatus !== 'listed') return json({ error: '你選擇的商品已售完，請重新確認選購清單。' }, 409)
      const unitPrice = priceFor(product, line.size)
      subtotal += unitPrice * line.quantity
      itemDetails.push({ productId: product.id, name: product.name, size: line.size, quantity: line.quantity, unitPrice })
    }
    const shipping = order.deliveryMethod === 'convenience_store' ? SHIPPING_FEE : 0
    const orderId = `QC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const total = subtotal + shipping
    let saved = await fetch(appScriptUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bridgeToken,
        orderId,
        createdAt: new Date().toISOString(),
        customerName: order.customerName,
        phone: order.phone,
        deliveryMethod: order.deliveryMethod,
        storeInfo: order.storeInfo,
        note: order.note,
        items: itemDetails,
        subtotal,
        shipping,
        total,
        privacyConsent: true,
        retentionPolicy: 'v1-90days',
      }),
      signal: request.signal,
    })
    if (saved.status === 301 || saved.status === 302 || saved.status === 303) {
      const location = saved.headers.get('location')
      if (!location) throw new Error('Apps Script response redirect missing location')
      const contentUrl = new URL(location, appScriptUrl)
      if (contentUrl.protocol !== 'https:' || contentUrl.hostname !== 'script.googleusercontent.com' || contentUrl.pathname !== '/macros/echo') {
        throw new Error('Unexpected Apps Script response redirect')
      }
      saved = await fetch(contentUrl, { method: 'GET', signal: request.signal })
    }
    if (!saved.ok) throw new Error('Apps Script order write failed')
    const savedOrder = await saved.json() as { status?: unknown; orderId?: unknown; notification?: unknown }
    if (savedOrder.status !== 'success' || savedOrder.orderId !== orderId) throw new Error('Apps Script order write was not confirmed')
    return json({ orderId, subtotal, shipping, total, currency: 'TWD', ownerNotified: savedOrder.notification === 'sent' }, 201)
  } catch {
    return json({ error: 'Order could not be saved. Please contact the shop before retrying.' }, 502)
  }
}
