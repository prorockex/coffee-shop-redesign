import { useCallback, useEffect, useMemo, useState } from 'react'
import { canAddMore, filterProducts, getAvailableProducts, getCartTotal, isProductAvailable, products, stockSnapshotCodes, priceFor, type BagSize, type CartLine, type Product } from './catalog'
import { parseStockFeed, stockSyncLabel, type StockSyncState } from './stock-feed'
import './App.css'

type Status = 'new' | 'working' | 'done'
type PreviewOrder = { id: string; guest: string; time: string; status: Status; lines: CartLine[] }

const demoOrders: PreviewOrder[] = [
  { id: 'DEMO-028', guest: '示意顧客 A', time: '示意日期・09:40', status: 'new', lines: [{ productId: 'kenya-ab-top-honey-riruni', size: 'half', quantity: 1 }] },
  { id: 'DEMO-027', guest: '示意顧客 B', time: '示意日期・昨天', status: 'working', lines: [{ productId: 'ethiopia-angel-geisha', size: 'one', quantity: 1 }, { productId: 'kenya-aa-faq', size: 'half', quantity: 1 }] },
  { id: 'DEMO-026', guest: '示意顧客 C', time: '示意日期・前天', status: 'done', lines: [{ productId: 'colombia-narino-floral-geisha', size: 'half', quantity: 1 }] },
]

const statusLabels: Record<Status, string> = { new: '待處理', working: '處理中', done: '已完成' }
const priceText = (amount: number) => `$${amount.toLocaleString('zh-TW')}`
const bagLabel = (size: BagSize) => size === 'half' ? '半磅' : '一磅'

function useStockFeed(onStockCodes?: (codes: readonly string[]) => void) {
  const [stockCodes, setStockCodes] = useState<readonly string[]>(stockSnapshotCodes)
  const [syncState, setSyncState] = useState<StockSyncState>('snapshot')
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
        setStockCodes(feed.stockCodes)
        setCheckedAt(feed.checkedAt)
        setSyncState('live')
        onStockCodes?.(feed.stockCodes)
      } catch {
        if (mounted) setSyncState((current) => current === 'live' ? 'stale' : current)
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
  }, [onStockCodes])

  return { stockCodes, syncState, checkedAt }
}

function ShopHeader({ cartCount, onCart, cartOpen = false, isAdmin = false }: { cartCount: number; onCart?: () => void; cartOpen?: boolean; isAdmin?: boolean }) {
  return (
    <header className="masthead">
      <a className="brand" href="/" aria-label="老邱自家烘焙首頁">
        <span className="brand-mark" aria-hidden="true">老邱</span>
        <span className="brand-name"><strong>老邱自家烘焙</strong></span>
      </a>
      <nav className="main-nav" aria-label="主要導覽">
        <a href={isAdmin ? '/' : '#catalog'}>{isAdmin ? '回到豆單' : '選豆'}</a>
        {!isAdmin && <a href="/admin">訂單管理預覽</a>}
      </nav>
      {!isAdmin && onCart && (
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

function Storefront() {
  const [query, setQuery] = useState('')
  const [processFilter, setProcessFilter] = useState('全部')
  const [sizes, setSizes] = useState<Record<string, BagSize>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const handleStockUpdate = useCallback((codes: readonly string[]) => {
    setCart((current) => {
      const next = current.filter((line) => {
        const product = products.find((item) => item.id === line.productId)
        return Boolean(product && isProductAvailable(product, codes))
      })
      return next.length === current.length ? current : next
    })
  }, [])
  const { stockCodes: activeStockCodes, syncState, checkedAt } = useStockFeed(handleStockUpdate)

  const availableProducts = useMemo(() => getAvailableProducts(products, activeStockCodes), [activeStockCodes])
  const filtered = useMemo(() => filterProducts(availableProducts, query).filter((product) => processFilter === '全部' || product.process.includes(processFilter)), [availableProducts, query, processFilter])
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const total = getCartTotal(cart)
  const syncTime = checkedAt ? new Date(checkedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''
  const stockSyncText = `${stockSyncLabel(syncState)}${syncTime ? ` 最近檢查 ${syncTime}。` : ''} 本預覽不接受真實訂單。`

  function addProduct(product: Product) {
    const size = sizes[product.id] ?? 'half'
    if (!canAddMore(cart, product, size, 1, activeStockCodes)) {
      setNotice('這款目前沒有現貨編號，不開放加入選豆單。')
      return
    }
    setCart((current) => {
      const found = current.find((line) => line.productId === product.id && line.size === size)
      if (found) return current.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line)
      return [...current, { productId: product.id, size, quantity: 1 }]
    })
    setNotice(`已將「${product.name}」加入選豆單。`)
    setCartOpen(true)
  }

  function changeQuantity(line: CartLine, delta: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== line.productId || item.size !== line.size) return [item]
      const quantity = item.quantity + delta
      return quantity > 0 ? [{ ...item, quantity }] : []
    }))
  }

  return (
    <div className="site-shell">
      <ShopHeader cartCount={cartCount} onCart={() => setCartOpen((open) => !open)} cartOpen={cartOpen} />
      <main>
        <section className="hero-edition" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">今天，想喝哪一支咖啡？</h1>
            <p className="hero-description">從產地、處理法與風味，慢慢挑一支合心意的咖啡豆。</p>
            <a className="primary-link" href="#catalog"><Icon name="arrow" /><span>瀏覽現貨豆款</span></a>
            <p className="edition-note">半磅與一磅規格・價格清楚列明</p>
          </div>
          <figure className="hero-artwork"><img className="hero-plate" src="/hero-paper-sculpture.png" alt="以紙雕呈現的咖啡枝葉、成熟咖啡果與烘焙咖啡豆" /></figure>
        </section>

        <div className="notice-ribbon" role="note">
          <span className="ribbon-stamp">預覽</span>
          <p role="status" aria-live="polite">{stockSyncText}</p>
          <a href="/admin">查看管理介面預覽</a>
        </div>

        <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <h2 id="catalog-title">本期豆單</h2>
              <p className="small-overline">COFFEE INDEX · 老邱自家烘焙</p>
              <p className="catalog-intro">只列出第一欄有編號的現貨品項；風味與價格依商品表整理。</p>
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
                const needsReview = product.inventoryStatus === 'review'
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
                        <button className="add-button" type="button" disabled={needsReview} onClick={() => addProduct(product)}>
                          {needsReview ? '庫存待確認' : <><Icon name="plus" />加入選豆單</>}
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

      <footer className="site-footer"><a className="footer-brand" href="/">老邱自家烘焙</a><p>{stockSyncLabel(syncState)} 出貨方式以店主確認為準。</p><a href="/admin">管理介面預覽</a></footer>

      <aside id="cart-panel" className={`cart-panel ${cartOpen ? 'is-open' : ''}`} aria-label="選豆單" aria-hidden={!cartOpen} inert={!cartOpen}>
        <div className="cart-heading"><div><h2>選豆單 <span>{cartCount}</span></h2></div><button type="button" className="close-panel" onClick={() => setCartOpen(false)} aria-label="關閉選豆單"><Icon name="close" /></button></div>
        {cart.length === 0 ? (
          <div className="cart-empty"><span className="empty-mark">豆</span><h3>選豆單目前是空的</h3><p>從豆單選擇喜歡的品項，加入後會顯示在這裡。</p><a href="#catalog" onClick={() => setCartOpen(false)}>回到本期豆單 <Icon name="arrow" /></a></div>
        ) : (
          <>
            <ul className="cart-lines">
              {cart.map((line) => {
                const product = products.find((item) => item.id === line.productId)
                if (!product) return null
                return <li key={`${line.productId}-${line.size}`} className="cart-line">
                  <div><h3>{product.name}</h3><p>{bagLabel(line.size)}・{priceText(priceFor(product, line.size))}／袋</p></div>
                  <div className="quantity-control" aria-label={`${product.name}數量`}>
                    <button type="button" onClick={() => changeQuantity(line, -1)} aria-label={`減少${product.name}`}><Icon name="minus" /></button><span>{line.quantity}</span><button type="button" onClick={() => changeQuantity(line, 1)} aria-label={`增加${product.name}`}><Icon name="plus" /></button>
                  </div>
                </li>
              })}
            </ul>
            <div className="cart-total"><span>商品小計</span><strong>{priceText(total)}</strong></div>
            <div className="preview-gate"><p className="gate-title">訂單送出尚未啟用</p><p>Google 試算表串接、管理員驗證與取貨／配送規則尚未設定。此預覽不會送出或儲存任何訂單資料。</p><button type="button" disabled>確認訂單</button></div>
          </>
        )}
        {notice && <p className="sr-only" role="status">{notice}</p>}
      </aside>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {cartCount > 0 && <button type="button" className="mobile-cart" onClick={() => setCartOpen((open) => !open)}><Icon name="bag" />查看選豆單・{cartCount} 件 <strong>{priceText(total)}</strong></button>}
    </div>
  )
}

function AdminPreview() {
  const { syncState } = useStockFeed()
  const [orders, setOrders] = useState(demoOrders)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const visibleOrders = orders.filter((order) => filter === 'all' || order.status === filter)
  const counts = { all: orders.length, new: orders.filter((order) => order.status === 'new').length, working: orders.filter((order) => order.status === 'working').length, done: orders.filter((order) => order.status === 'done').length }

  return (
    <div className="site-shell admin-shell">
      <ShopHeader cartCount={0} isAdmin />
      <main className="admin-main">
        <div className="admin-topline"><a href="/" className="back-link"><Icon name="arrow" />回到豆單</a><span className="preview-stamp">預覽介面</span></div>
        <div className="admin-title"><div><h1>訂單管理</h1><p>查看示意訂單，並更新處理狀態。</p></div></div>
        <div className="admin-warning" role="note"><strong>模擬資料</strong><p>這裡的顧客、時間與訂單皆為虛構示意，狀態變更只留在目前分頁。{stockSyncLabel(syncState)} 訂單與管理員登入尚未串接。</p></div>
        <div className="order-filters" role="group" aria-label="訂單狀態篩選">
          {([['all', '全部', counts.all], ['new', '待處理', counts.new], ['working', '處理中', counts.working], ['done', '已完成', counts.done]] as const).map(([key, label, count]) => (
            <button key={key} type="button" className={filter === key ? 'order-filter active' : 'order-filter'} aria-pressed={filter === key} onClick={() => setFilter(key)}><span>{label}</span><strong>{count}</strong></button>
          ))}
        </div>
        {visibleOrders.length === 0 ? <div className="empty-results"><span className="empty-mark">空</span><h2>這個狀態還沒有示意訂單</h2></div> : (
          <ul className="order-list">
            {visibleOrders.map((order) => <li key={order.id}>
              <article className="order-entry">
                <div className="order-meta"><strong>{order.id}</strong><span>{order.time}</span></div>
                <div className="order-detail"><h2>{order.guest}</h2><ul>{order.lines.map((line) => {
                  const product = products.find((item) => item.id === line.productId)
                  return product ? <li key={line.productId}>{product.name}・{bagLabel(line.size)} × {line.quantity}</li> : null
                })}</ul></div>
                <div className="order-total"><span>商品小計</span><strong>{priceText(getCartTotal(order.lines))}</strong></div>
                <label className="status-select-label">訂單狀態<select value={order.status} onChange={(event) => setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: event.target.value as Status } : item))}><option value="new">待處理</option><option value="working">處理中</option><option value="done">已完成</option></select></label>
                <span className={`status-ink ${order.status}`}>{statusLabels[order.status]}</span>
              </article>
            </li>)}
          </ul>
        )}
      </main>
      <footer className="site-footer"><a className="footer-brand" href="/">老邱自家烘焙</a><p>管理介面正式啟用前，需先完成管理員驗證與試算表授權。</p><a href="/">回到豆單</a></footer>
    </div>
  )
}

export default function App() {
  return window.location.pathname.replace(/\/$/, '') === '/admin' ? <AdminPreview /> : <Storefront />
}
