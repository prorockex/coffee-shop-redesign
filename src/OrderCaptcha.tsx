import { useEffect, useRef } from 'react'

const SITE_KEY = '0x4AAAAAAFPWvzMrZPDvSBz4'

type TurnstileOptions = {
  sitekey: string
  action: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  theme: 'light' | 'dark' | 'auto'
}
type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loadPromise: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-loader]')
      const script = existing ?? document.createElement('script')
      const onLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to load'))
      const onError = () => reject(new Error('Turnstile failed to load'))
      script.addEventListener('load', onLoad, { once: true })
      script.addEventListener('error', onError, { once: true })
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.turnstileLoader = 'true'
        document.head.appendChild(script)
      }
      if (window.turnstile) onLoad()
    })
  }
  return loadPromise
}

export function OrderCaptcha({ onToken, resetKey }: { onToken: (token: string) => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    let active = true
    void loadTurnstile().then((turnstile) => {
      if (!active || !container.current || widgetId.current) return
      widgetId.current = turnstile.render(container.current, {
        sitekey: SITE_KEY,
        action: 'order',
        theme: 'light',
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      })
    }).catch(() => onTokenRef.current(''))
    return () => {
      active = false
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current)
    }
  }, [resetKey])

  return <div ref={container} className="turnstile-slot" aria-label="防止自動送單驗證" />
}
