import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { products } from './src/catalog.ts'

// Dev-only stand-in so the storefront can be previewed without the Pages stock function.
// It does not read the sheet, and it never runs in `vite build` / Cloudflare.
function illustrativeStockPlugin(): Plugin {
  return {
    name: 'illustrative-stock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/api/stock' || req.method !== 'GET') return next()
        const listed = products.filter((product) => product.inventoryStatus === 'listed').slice(0, 6)
        res.statusCode = 200
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-stock-illustrative', '1')
        res.end(JSON.stringify({ products: listed, checkedAt: new Date().toISOString() }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), illustrativeStockPlugin()],
  server: {
    allowedHosts: ['rockmac-mini.tailb880b7.ts.net'],
  },
})
