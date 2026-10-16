# 老邱自家烘焙｜咖啡豆選集

Vite + React + TypeScript storefront preview, following the owner's current preference for a calm, white paper-layered coffee field guide with a paper-sculpture cover.

## Run locally

```sh
npm install
npm run dev
```

- Storefront: `/`
- Order-management preview: `/admin`
- Tests: `npm test`
- Production bundle check: `npm run build`
- Lint: `npm run lint`

## Preview through Tailscale

When Tailscale is connected, start the dev server on this Mac’s Tailscale interface with `npm run dev -- --host "$(tailscale ip -4)" --port 4173 --strictPort`. The current MagicDNS preview is `http://rockmac-mini.tailb880b7.ts.net:4173/`; `/admin` opens the demo order view. The server binds only to the Tailscale IP, not the public network. Tailscale Serve is not enabled on this tailnet, so the preview uses HTTP on port 4173 rather than HTTPS on the default port.

## What works in this preview

- Show the 6 products whose `Products` column I (上架 checkbox) is checked; unchecked/blank rows are hidden (snapshot fallback reflects the last read). All 27 sheet names matched the catalog.
- Search visible products by product, origin, processing method, or tasting notes.
- Filter by processing method; choose half-pound/one-pound pricing and build a cart.
- Inspect calculated subtotals and change quantities.
- Open `/admin` to filter three explicitly fictional orders and change their status for the current page session.

## Not connected / launch gates

This is a local preview. Checkout is intentionally disabled; the app sends and stores no customer data. The admin view has no authentication and uses in-memory fake data only. A private Cloudflare Pages Function for live stock is implemented, but it is not deployed or configured yet. The Tailscale/Vite preview therefore falls back to the last-read stock snapshot. Live orders, shipping/pickup rules, and Cloudflare deployment are not configured.

### Activate automatic stock sync

`functions/api/stock.ts` reads only `Products!A2:I1000` (UNFORMATTED_VALUE) with the Google Sheets `spreadsheets.readonly` scope and returns the column-A IDs of rows whose column I checkbox is TRUE from `/api/stock`. The storefront requests this feed on page load and every 30 seconds; sold-out products are hidden and removed from the cart. The feed never reads or returns customer/order tabs, names, prices, or other columns.

To activate it, deploy the project as Cloudflare Pages with Functions enabled, create a dedicated Google Cloud service account with the Sheets API enabled, and share only the inventory spreadsheet with that account as Viewer. Configure these Cloudflare variables/secrets: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (secret), `STOCK_SHEET_ID`, and optional `STOCK_SHEET_TAB` (defaults to `Products`). Keep private-key material in Cloudflare secrets or an ignored local `.dev.vars` file—never in source control or chat. The current Tailscale/Vite preview does not run Pages Functions, so it continues to display the fallback snapshot until a Pages runtime is configured.

Before the site accepts orders, configure a separate server-side order integration, a real admin authentication boundary, and the agreed order fields/statuses. Prefer a separate `網站訂單` tab rather than altering the legacy order tab; confirm that target before the first live write. Confirm the displayed currency, current prices, and fulfillment rules before public launch.

## Data and privacy

The source XLSX is deliberately kept outside this repository: it contains existing customer/order records in addition to the product catalog. The XLSX product fields are in `src/catalog.ts`; six availability IDs from the separate Google Sheet stock snapshot are the offline fallback. The original workbook, customer details, and legacy orders are not included in the app or build output. `.gitignore` excludes spreadsheet files and local environment secrets. Keep the GitHub repository private; only publish the storefront after the integration and launch checks are complete.

Availability is determined by the `Products` sheet's column I (上架 checkbox): TRUE means listed; unchecked or blank means hidden. Column A (`ID`) maps rows to catalog products. The latest verified snapshot has 6 available and 21 sold-out products. Automatic sync is implemented in the Pages Function but remains inactive until the service account and Cloudflare deployment are configured.

## Typography and artwork

The hero uses an original generated paper-sculpture coffee illustration at `public/hero-paper-sculpture.png`; its exact generation prompt is embedded in the PNG metadata. The interface uses the system sans-serif stack and requires no remote fonts.
