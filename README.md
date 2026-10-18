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
- Filter by processing method; choose half-pound/one-pound pricing, a required roast (淺焙 / 中焙 / 深焙) on every bean, and build a cart. The same bean at a different roast is a separate cart line.
- Inspect calculated subtotals and change quantities.
- Open `/admin` to filter three explicitly fictional orders and change their status for the current page session.

## Not connected / launch gates

This is a local preview. Checkout is intentionally disabled; the app sends and stores no customer data. The admin view has no authentication and uses in-memory fake data only. A private Cloudflare Pages Function for live stock is implemented, but it is not deployed or configured yet. The Tailscale/Vite preview therefore falls back to the last-read stock snapshot. Live orders, shipping/pickup rules, and Cloudflare deployment are not configured.

### Activate automatic stock sync

`functions/api/stock.ts` reads only `Products!A2:I1000` (UNFORMATTED_VALUE) with the Google Sheets `spreadsheets.readonly` scope and returns the column-A IDs of rows whose column I checkbox is TRUE from `/api/stock`. The storefront requests this feed on page load and every 30 seconds; sold-out products are hidden and removed from the cart. The feed never reads or returns customer/order tabs, names, prices, or other columns.

To activate it, deploy the project as Cloudflare Pages with Functions enabled, create a dedicated Google Cloud service account with the Sheets API enabled, and share only the inventory spreadsheet with that account as Viewer. Configure these Cloudflare variables/secrets: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (secret), `STOCK_SHEET_ID`, and optional `STOCK_SHEET_TAB` (defaults to `Products`). Keep private-key material in Cloudflare secrets or an ignored local `.dev.vars` file—never in source control or chat. The current Tailscale/Vite preview does not run Pages Functions, so it continues to display the fallback snapshot until a Pages runtime is configured.

Before the site accepts orders, configure a separate server-side order integration, a real admin authentication boundary, and the agreed order fields/statuses. Website orders now append to the legacy `Orders` tab in the matching 8-column layout (see below). Confirm the displayed currency, current prices, and fulfillment rules before public launch.

## Data and privacy

The source XLSX is deliberately kept outside this repository: it contains existing customer/order records in addition to the product catalog. The XLSX product fields are in `src/catalog.ts`; six availability IDs from the separate Google Sheet stock snapshot are the offline fallback. The original workbook, customer details, and legacy orders are not included in the app or build output. `.gitignore` excludes spreadsheet files and local environment secrets. Keep the GitHub repository private; only publish the storefront after the integration and launch checks are complete.

Availability is determined by the `Products` sheet's column I (上架 checkbox): TRUE means listed; unchecked or blank means hidden. Column A (`ID`) maps rows to catalog products. The latest verified snapshot has 6 available and 21 sold-out products. Automatic sync is implemented in the Pages Function but remains inactive until the service account and Cloudflare deployment are configured.

## Typography and artwork

The homepage cover picks one of nine shop photographs in `public/covers/` at random on each page load (`cover-06` was not supplied). Sources are 1280×720 and shipped as WebP. The earlier paper-sculpture illustration remains at `public/hero-paper-sculpture.png`. The interface uses the system sans-serif stack and requires no remote fonts.


## Listing rule (2026-10-16)

The storefront list comes only from the `Products` sheet: every row whose column I (`上架` checkbox) is TRUE is shown, using B 名稱, C 產區, D 豆種, E 處理法, F 風味描述, G 半磅價格, H 一磅價格 from that row. Column A (ID) is not used. A new bean = new sheet row + tick, no code change. Missing fields are filled from the static catalog in `src/catalog.ts` by normalized name when possible; rows without a name or prices are skipped. `/api/stock` returns `{ products, checkedAt }`; `/api/orders` re-reads the sheet and prices items from it. If the feed fails before any success the page shows an error state (no static fallback, to avoid selling unlisted beans); after a success it keeps the last list.

## Roast level on every order

Every listed bean asks for a roast before it can be added: `淺焙`, `中焙`, or `深焙`. The same bean with a different roast is a separate cart line, and the roast can be changed in the cart. `/api/orders` requires `roastLevel` on each item and rejects a missing or any other value. The Pages Function forwards that value to the Apps Script bridge.

### Order sheet target (Orders tab)

Website orders are appended to the **`Orders`** tab of the spreadsheet 「老邱自家烘焙 gemini」 (`1BxRlCcvVjLYEdhyIt2B7969k2i-kXKfwvviPFhLUi_g`), the same tab that holds the historical orders from the older site. That tab has **no header row** and 8 columns; new rows follow the same layout so they line up with the old ones:

| Column | Contents |
| --- | --- |
| A | 訂單編號 (website ids look like `QC-20261018-A1B2C3D4`; old ones `ORD-MMDD-HHMMSS`) |
| B | 下單時間 (date, format `yyyy/mm/dd h:mm:ss`) |
| C | 姓名 |
| D | 電話 (stored as text) |
| E | `自取` or `超商取貨` |
| F | 品項, one line per item: `【品名】 烘焙度 / 規格 x數量` |
| G | 總額 (including the NT$60 convenience-store shipping) |
| H | 超商門市 for 超商取貨, plus the customer note (`備註：…` on its own line when both exist) |

Example row: `QC-20261018-A1B2C3D4 | 2026/10/18 13:30:00 | 王小明 | 0912345678 | 自取 | 【衣索比亞 金寶藝妓 水洗】 淺焙 / 半磅 x1 | 350 | 下午來拿`.

Subtotal, shipping, status and retention-policy columns are no longer written to the sheet. The owner notification email (MailApp) keeps the full detail: each item with roast, unit price and line total, plus subtotal, shipping and total.

### Redeploy OrderBridge.gs

`apps-script/OrderBridge.gs` changed. Orders keep going to the old sheet until the script in the Apps Script editor is replaced and the **existing** web app deployment is updated (same URL):

1. Open the Apps Script project and replace the whole `OrderBridge.gs` contents with the file from this repo.
2. Deploy → Manage deployments → edit the current deployment → Version: New version → Deploy.

Do not create a new deployment; that would change the URL stored in `APPS_SCRIPT_URL`.
