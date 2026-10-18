import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { canAddMore, filterProducts, getCartTotal, isRoastLevel, priceFor, ROAST_LEVELS, type BagSize, type CartLine, type Product, type RoastLevel } from './catalog'
import { changeLineQuantity, lineMatchKey, retargetCartLine, upsertCartLine } from './roast'
import { parseStockFeed, stockSyncLabel, type StockSyncState } from './stock-feed'
import { submitOrder, type OrderReceipt } from './order-client'
import { OrderCaptcha } from './OrderCaptcha'
import { isValidPhone, normalizePhone } from './phone'
import './App.css'

const priceText = (amount: number) => `$${amount.toLocaleString('zh-TW')}`
const bagLabel = (size: BagSize) => size === 'half' ? '半磅' : '一磅'

const HOME_COVERS = [
  { src: '/covers/cover-01.webp', alt: '清晨窗邊的手沖咖啡，玻璃壺盛著琥珀色咖啡，旁邊攤著一本打開的書' },
  { src: '/covers/cover-02.webp', alt: '晨光落在木桌上的手沖壺、淺焙咖啡豆、玻璃杯與翻開的書' },
  { src: '/covers/cover-03.webp', alt: '窗邊晨光中的手沖桌，玻璃壺、拉花拿鐵、淺焙豆與打開的書' },
  { src: '/covers/cover-04.webp', alt: '木質桌面上的手沖咖啡與拉花拿鐵，旁邊是淺焙豆、玻璃壺和翻開的書' },
  { src: '/covers/cover-05.webp', alt: '從上方看向木桌，淺焙咖啡豆、手沖壺、玻璃咖啡杯與翻開的書' },
  { src: '/covers/cover-07.webp', alt: '窗光灑在木桌上，拉花拿鐵、淺焙豆、手沖壺與翻開的書' },
  { src: '/covers/cover-08.webp', alt: '俯瞰的咖啡桌面，淺焙豆、手沖壺、拉花拿鐵與一本打開的書' },
  { src: '/covers/cover-09.webp', alt: '清晨窗邊的手沖場景，玻璃壺、淺焙豆、拉花咖啡與翻開的書' },
  { src: '/covers/cover-10.webp', alt: '俯瞰木桌一角，玻璃手沖壺、淺焙豆、拉花拿鐵與翻開的書' },
] as const

function pickHomeCover() {
  return HOME_COVERS[Math.floor(Math.random() * HOME_COVERS.length)]
}

function useStockFeed(onProducts?: (items: readonly Product[]) => void) {
  const [liveProducts, setLiveProducts] = useState<Product[]>([])
  const [syncState, setSyncState] = useState<StockSyncState>('loading')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let inFlight = false

    async function refreshStock() {
      if (inFlight) return
      inFlight = true
      try {
        const response = await fetch('/api/stock', { cache: 'no-store' })
        if (!response.ok) throw new Error('Stock feed unavailable')
        const feed = parseStockFeed(await response.json())
        if (!mounted) return
        setLiveProducts(feed.products)
        setCheckedAt(feed.checkedAt)
        setSyncState('live')
        onProducts?.(feed.products)
      } catch {
        if (mounted) setSyncState((current) => current === 'live' || current === 'stale' ? 'stale' : 'error')
      } finally {
        inFlight = false
      }
    }

    void refreshStock()
    const interval = window.setInterval(() => void refreshStock(), 30_000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [onProducts])

  return { liveProducts, syncState, checkedAt }
}

function ShopHeader({ cartCount, onCart, cartOpen = false }: { cartCount: number; onCart?: () => void; cartOpen?: boolean }) {
  return (
    <header className="masthead">
      <a className="brand" href="/" aria-label="老邱自家烘焙首頁">
        <span className="brand-mark" aria-hidden="true">老邱</span>
        <span className="brand-name"><strong>老邱自家烘焙</strong></span>
      </a>
      <nav className="main-nav" aria-label="主要導覽">
        <a href="#catalog">選豆</a>
      </nav>
      {onCart && (
        <button className="cart-trigger" type="button" onClick={onCart} aria-controls="cart-panel" aria-expanded={cartOpen}>
          <Icon name="bag" /><span>選豆單</span><span className="cart-count" aria-label={`${cartCount} 件`}>{cartCount}</span>
        </button>
      )}
    </header>
  )
}

function Icon({ name }: { name: 'bag' | 'search' | 'arrow' | 'plus' | 'minus' | 'close' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  if (name === 'bag') return <svg {...common}><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.2 4.2" /></svg>
  if (name === 'arrow') return <svg {...common}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (name === 'minus') return <svg {...common}><path d="M5 12h14" /></svg>
  return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function RoastSelector({ name, value, onChange, disabled = false, compact = false }: {
  name: string
  value: RoastLevel | null
  onChange: (level: RoastLevel) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <fieldset className={compact ? 'roast-choice is-compact' : 'roast-choice'} disabled={disabled} aria-required="true">
      <legend>烘焙度</legend>
      <div className="roast-options" role="group" aria-label={`${name}的烘焙度`}>
        {ROAST_LEVELS.map((level) => (
          <button key={level} type="button" aria-pressed={value === level} onClick={() => onChange(level)}>{level}</button>
        ))}
      </div>
    </fieldset>
  )
}

function Storefront() {
  const [query, setQuery] = useState('')
  const [processFilter, setProcessFilter] = useState('全部')
  const [sizes, setSizes] = useState<Record<string, BagSize>>({})
  const [roasts, setRoasts] = useState<Record<string, RoastLevel>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'convenience_store'>('pickup')
  const [storeInfo, setStoreInfo] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null)
  const [website, setWebsite] = useState('')
  const [shippingContact, setShippingContact] = useState('')
  const handleStockUpdate = useCallback((items: readonly Product[]) => {
    setCart((current) => {
      const next = current.filter((line) => items.some((item) => item.id === line.productId))
      return next.length === current.length ? current : next
    })
  }, [])
  const { liveProducts: availableProducts, syncState, checkedAt } = useStockFeed(handleStockUpdate)

  const filtered = useMemo(() => filterProducts(availableProducts, query).filter((product) => processFilter === '全部' || product.process.includes(processFilter)), [availableProducts, query, processFilter])
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const total = getCartTotal(cart, availableProducts)
  const syncTime = checkedAt ? new Date(checkedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''
  const stockSyncText = `${stockSyncLabel(syncState)}${syncTime ? ` 最近檢查 ${syncTime}。` : ''} 下單後由店主與你確認交付方式。`
  const shipping = deliveryMethod === 'convenience_store' ? 60 : 0
  const grandTotal = total + shipping
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])
  const [cover] = useState(pickHomeCover)
  const coverImageRef = useRef<HTMLImageElement>(null)
  const [coverShown, setCoverShown] = useState(false)

  useEffect(() => {
    const image = coverImageRef.current
    if (image?.complete && image.naturalWidth > 0) setCoverShown(true)
  }, [cover.src])

  function addProduct(product: Product) {
    setReceipt(null)
    setShippingContact('')
    const size = sizes[product.id] ?? 'half'
    const roastLevel = roasts[product.id]
    if (!isRoastLevel(roastLevel)) {
      setNotice('請先選擇烘焙度。')
      return
    }
    if (!canAddMore(cart, product, size, 1)) {
      setNotice('這款目前暫不開放加入選豆單。')
      return
    }
    setCart((current) => upsertCartLine(current, { productId: product.id, size, quantity: 1, roastLevel }))
    setNotice(`已將「${product.name}」（${roastLevel}）加入選豆單。`)
    setCartOpen(false)
  }

  function changeQuantity(line: CartLine, delta: number) {
    setCart((current) => changeLineQuantity(current, line, delta))
  }

  function setLineRoast(line: CartLine, roastLevel: RoastLevel) {
    setCart((current) => retargetCartLine(current, line, roastLevel))
  }

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!privacyConsent) {
      setFormError('請先勾選個資使用說明。')
      return
    }
    if (!turnstileToken) {
      setFormError('請先完成防自動送單驗證。')
      return
    }
    const phone = normalizePhone(customerPhone)
    if (!isValidPhone(phone)) {
      setFormError('電話格式不正確，請填 8 到 15 位數字，例如 0912345678。')
      return
    }
    const items = cart.filter((line) => availableProducts.some((product) => product.id === line.productId))
    if (items.length !== cart.length) setCart(items)
    if (items.length === 0) {
      setFormError('選豆單中的商品已下架，請重新選購。')
      return
    }
    if (items.some((line) => !isRoastLevel(line.roastLevel))) {
      setFormError('請為每項商品選擇烘焙度（淺焙、中焙或深焙）。')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const submitted = await submitOrder({
        customerName,
        phone,
        deliveryMethod,
        storeInfo: deliveryMethod === 'convenience_store' ? storeInfo : '',
        note: orderNote,
        items,
        privacyConsent: true,
        turnstileToken,
        website,
      })
      setReceipt(submitted)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setStoreInfo('')
      setOrderNote('')
      setPrivacyConsent(false)
      setWebsite('')
      setTurnstileToken('')
      setCaptchaResetKey((key) => key + 1)
      setShippingContact('店主會與你聯絡，確認交付方式。')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '訂單送出失敗，請稍後再試。')
      setTurnstileToken('')
      setCaptchaResetKey((key) => key + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="site-shell">
      <ShopHeader cartCount={cartCount} onCart={() => setCartOpen((open) => !open)} cartOpen={cartOpen} />
      <main>
        <section className="hero-edition" aria-labelledby="hero-title">
          <img
            ref={coverImageRef}
            className={coverShown ? 'hero-plate is-shown' : 'hero-plate'}
            src={cover.src}
            alt={cover.alt}
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
            onLoad={() => setCoverShown(true)}
          />
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-copy">
            <h1 id="hero-title">今天，想喝哪一支咖啡？</h1>
            <p className="hero-description">從產地、處理法與風味，慢慢挑一支合心意的咖啡豆。</p>
            <a className="primary-link" href="#catalog"><Icon name="arrow" /><span>瀏覽現貨豆款</span></a>
            <p className="edition-note">半磅與一磅規格・價格清楚列明</p>
          </div>
        </section>

        <div className="notice-ribbon" role="note">
          <span className="ribbon-stamp">現貨</span>
          <p role="status" aria-live="polite">{stockSyncText}</p>
          <span>朋友下單平台</span>
        </div>

        <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <h2 id="catalog-title">本期豆單</h2>
              <p className="small-overline">COFFEE INDEX · 老邱自家烘焙</p>
              <p className="catalog-intro">只列出商品表中勾選「上架」的品項；風味與價格依商品表整理。每款下單前請選擇烘焙度。</p>
            </div>
            <p className="result-count" aria-live="polite">找到 <strong>{filtered.length}</strong> 款</p>
          </div>

          <div className="catalog-tools">
            <label className="search-field">
              <Icon name="search" />
              <span className="sr-only">搜尋產地、處理法或風味</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="找產地、處理法或風味" />
              {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="清除搜尋"><Icon name="close" /></button>}
            </label>
            <div className="filter-row" role="group" aria-label="依處理法篩選">
              {['全部', '水洗', '日曬', '蜜處理', '白蜜處理'].map((filter) => (
                <button key={filter} type="button" className={processFilter === filter ? 'filter-chip selected' : 'filter-chip'} aria-pressed={processFilter === filter} onClick={() => setProcessFilter(filter)}>{filter}</button>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <ul className="product-list">
              {filtered.map((product, index) => {
                const selectedSize = sizes[product.id] ?? 'half'
                const selectedRoast = roasts[product.id] ?? null
                const needsReview = product.inventoryStatus === 'review'
                const needsRoast = !needsReview && !isRoastLevel(selectedRoast)
                return (
                  <li key={product.id}>
                    <article className="product-entry">
                      <div className="entry-index"><span>{String(index + 1).padStart(2, '0')}</span><i aria-hidden="true" /></div>
                      <div className="entry-copy">
                        <div className="product-tags"><span>{product.origin}</span><span>{product.process}</span>{product.bean && <span>{product.bean}</span>}</div>
                        <h3>{product.name}</h3>
                        <p className="flavor-note">{product.flavor}</p>
                        {needsReview && <p className="inventory-note">原商品名稱帶有庫存註記，店主確認前暫不供選購。</p>}
                      </div>
                      <div className="entry-order">
                        <fieldset className="size-choice" disabled={needsReview}>
                          <legend>選擇重量</legend>
                          <button type="button" aria-pressed={selectedSize === 'half'} onClick={() => setSizes((current) => ({ ...current, [product.id]: 'half' }))}>
                            <span>半磅</span><strong>{priceText(product.priceHalf)}</strong>
                          </button>
                          <button type="button" aria-pressed={selectedSize === 'one'} onClick={() => setSizes((current) => ({ ...current, [product.id]: 'one' }))}>
                            <span>一磅</span><strong>{priceText(product.priceOne)}</strong>
                          </button>
                        </fieldset>
                        <RoastSelector
                          name={product.name}
                          value={selectedRoast}
                          disabled={needsReview}
                          onChange={(level) => setRoasts((current) => ({ ...current, [product.id]: level }))}
                        />
                        <button className="add-button" type="button" disabled={needsReview || needsRoast} onClick={() => addProduct(product)}>
                          {needsReview ? '庫存待確認' : needsRoast ? '請先選擇烘焙度' : <><Icon name="plus" />加入選豆單</>}
                        </button>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="empty-results"><span className="empty-mark">空</span><h3>沒有找到符合的咖啡</h3><p>試試別的產地、處理法或風味關鍵字。</p><button type="button" className="text-button" onClick={() => { setQuery(''); setProcessFilter('全部') }}>清除篩選 <Icon name="arrow" /></button></div>
          )}
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="/">老邱自家烘焙</a><p>{stockSyncLabel(syncState)} 自取或超商取貨（運費 $60）；下單後由店主確認交付方式。</p><a href="tel:0975386777">聯絡老邱・0975 386 777</a></footer>

      <aside id="cart-panel" className={`cart-panel ${cartOpen ? 'is-open' : ''}`} aria-label="選豆單" aria-hidden={!cartOpen} inert={!cartOpen}>
        <div className="cart-heading"><div><h2>選豆單 <span>{cartCount}</span></h2></div><button type="button" className="close-panel" onClick={() => setCartOpen(false)} aria-label="關閉選豆單"><Icon name="close" /></button></div>
        {cart.length === 0 ? (
          receipt ? <div className="order-success" role="status"><strong>訂單已送出</strong><p>訂單編號：<span>{receipt.orderId}</span></p><p>商品小計 {priceText(receipt.subtotal)}・運費 {priceText(receipt.shipping)}・合計 {priceText(receipt.total)}</p><p>{shippingContact}</p><p>{receipt.ownerNotified ? '店主已收到電子郵件通知。' : '訂單已記錄，但通知郵件未能寄出，請直接聯絡老邱。'}</p><a href="#catalog" onClick={() => setCartOpen(false)}>回到本期豆單 <Icon name="arrow" /></a></div> : <div className="cart-empty"><span className="empty-mark">豆</span><h3>選豆單目前是空的</h3><p>從豆單選擇喜歡的品項，加入後會顯示在這裡。</p><a href="#catalog" onClick={() => setCartOpen(false)}>回到本期豆單 <Icon name="arrow" /></a></div>
        ) : (
          <>
            <ul className="cart-lines">
              {cart.map((line) => {
                const product = availableProducts.find((item) => item.id === line.productId)
                if (!product) return null
                return <li key={lineMatchKey(line)} className="cart-line">
                  <div className="cart-line-copy">
                    <h3>{product.name}</h3>
                    <p>{bagLabel(line.size)}・{priceText(priceFor(product, line.size))}／袋・{line.roastLevel}</p>
                    <RoastSelector name={product.name} value={line.roastLevel} onChange={(level) => setLineRoast(line, level)} compact />
                  </div>
                  <div className="quantity-control" aria-label={`${product.name}${line.roastLevel}數量`}>
                    <button type="button" onClick={() => changeQuantity(line, -1)} aria-label={`減少${product.name}${line.roastLevel}`}><Icon name="minus" /></button><span>{line.quantity}</span><button type="button" onClick={() => changeQuantity(line, 1)} aria-label={`增加${product.name}${line.roastLevel}`}><Icon name="plus" /></button>
                  </div>
                </li>
              })}
            </ul>
            <section className="order-summary" aria-label="訂單摘要">
              <h3>訂單摘要</h3>
              <ul>
                {cart.map((line) => {
                  const product = availableProducts.find((item) => item.id === line.productId)
                  if (!product) return null
                  return (
                    <li key={lineMatchKey(line)}>
                      <p>{product.name}・{bagLabel(line.size)} × {line.quantity}</p>
                      <p>烘焙度 {line.roastLevel}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
            <button className="continue-shopping" type="button" onClick={() => { setCartOpen(false); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }}><Icon name="plus" />繼續選購其他豆款</button>
            <div className="cart-total"><span>商品小計</span><strong>{priceText(total)}</strong></div>
            <form className="order-form" onSubmit={handleSubmitOrder}>
              {receipt && <div className="order-success" role="status"><strong>訂單已送出</strong><p>訂單編號：<span>{receipt.orderId}</span></p><p>商品小計 {priceText(receipt.subtotal)}・運費 {priceText(receipt.shipping)}・合計 {priceText(receipt.total)}</p><p>{shippingContact}</p><p>{receipt.ownerNotified ? '店主已收到電子郵件通知。' : '訂單已記錄，但通知郵件未能寄出，請直接聯絡老邱。'}</p></div>}
              <label className="form-field">姓名<input required maxLength={80} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
              <label className="form-field">聯絡電話<input required maxLength={20} type="tel" autoComplete="tel" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
              <label className="form-field">配送方式<select value={deliveryMethod} onChange={(event) => { setDeliveryMethod(event.target.value as 'pickup' | 'convenience_store'); setFormError('') }}><option value="pickup">店面自取・$0</option><option value="convenience_store">超商取貨・+$60</option></select></label>
              {deliveryMethod === 'convenience_store' ? <label className="form-field">超商門市<input required maxLength={200} value={storeInfo} onChange={(event) => setStoreInfo(event.target.value)} placeholder="請填超商名稱、門市與店號" /></label> : <p className="form-hint">自取請於下單後聯絡老邱：<a href="tel:0975386777">0975 386 777</a></p>}
              <label className="form-field">備註（選填）<textarea maxLength={500} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} rows={3} /></label>
              <div className="cart-total shipping-line"><span>{deliveryMethod === 'convenience_store' ? '超商運費' : '運費'}</span><strong>{priceText(shipping)}</strong></div>
              <div className="cart-total grand-total"><span>應付總額</span><strong>{priceText(grandTotal)}</strong></div>
              <div className="privacy-consent"><label><input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} required /><span>我同意將姓名、電話、配送方式與門市資料用於處理本筆訂單。訂單完成 90 天後刪除聯絡與門市資料；必要帳務紀錄依法保存。</span></label></div>
              <div className="honeypot-field" aria-hidden="true"><label>網站<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div>
              <OrderCaptcha onToken={handleTurnstileToken} resetKey={captchaResetKey} />
              {formError && <p className="order-error" role="alert">{formError}</p>}
              <button className="submit-order" type="submit" disabled={submitting}>{submitting ? '送出中…' : '確認下單'}</button>
            </form>
          </>
        )}
        {notice && <p className="sr-only" role="status">{notice}</p>}
      </aside>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {cartCount > 0 && <button type="button" className="cart-fab" onClick={() => setCartOpen((open) => !open)}><Icon name="bag" />查看選豆單・{cartCount} 件 <strong>{priceText(total)}</strong></button>}
    </div>
  )
}

export default function App() {
  return <Storefront />
}
