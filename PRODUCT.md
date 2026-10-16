# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React + TypeScript, chosen by user from the recommended stack.

## Users

- Primary: customers choosing and ordering coffee from 老邱自家烘焙.
- Secondary: the shop owner managing customer orders and their statuses.

## Product Purpose

Replace the existing Google Sites storefront with a customer-facing coffee shop website and an order-management experience. Customers submit orders without online payment; orders are intended to be recorded in the owner's existing Google spreadsheet.

## Positioning

A direct storefront for 老邱自家烘焙; present the catalogue as a quiet paper field guide. The user requested a near-white, simple, Apple-inspired interface with thin rules, soft paper-tone layers, calm colors, and an original paper-cut coffee illustration on the cover.

## Operating Context

Customers browse products, select quantities, provide order details, and submit an order. The owner needs to review orders and update order status. Intended source of order records: the Google Sheet at `1BizaQ0-hODd3sxYiEJ2DFf2pRCZvu8msCi6UMKWHK0U`.

## Capabilities and Constraints

- Required eventual scope: storefront, customer order submission, and an owner-facing order-management interface.
- Orders should be written to the existing Google Sheet; no online payment is required.
- The user supplied an XLSX workbook whose `Products` sheet has 27 coffee listings with origin, processing, tasting notes, half-pound and one-pound prices. Treat those as the provided catalogue source; preserve its facts and mark any missing field as unknown.
- The workbook also contains customer/order information. Never copy that workbook, its orders, or customer details into the website repository, build output, or public hosting. Only the product fields needed for the storefront may be transcribed.
- Read-only access to the inventory Google Sheet is verified for its `Products` tab. A Cloudflare Pages Function is implemented to expose only the IDs (column A) of rows whose column I checkbox is TRUE in `Products!A2:I1000`, but Cloudflare deployment and dedicated service-account secrets are not configured, so the live endpoint is not active. Order writes, the order destination, and admin authentication remain unverified.
- Availability follows `Products` column I (上架 checkbox): TRUE means listed; unchecked/blank means hidden. Column A (`ID`) identifies the product. The latest verified snapshot has 6 available and 21 sold out, mapped to all 27 catalog entries. The storefront polls the prepared endpoint every 30 seconds when deployed and otherwise falls back to the snapshot; ignore historical quantity notes embedded in product names.
- Shipping/pickup rules, order fields, and status workflow remain open until the owner confirms production behavior.
- Do not publish fake product/pricing claims or transmit customer data to an unconfigured endpoint.
- GitHub source repository should be private. User authorized a publicly accessible customer storefront, but did not authorize a public source repository.
- User selected Cloudflare Pages as public storefront hosting. The server-side stock endpoint is implemented, but no Cloudflare deployment credentials or service-account secrets have been configured.

## Brand Commitments

- Shop name: 老邱自家烘焙.
- Existing Google Sites page title includes a horse emoji, but no other visual branding was verifiable from the page capture; do not treat the emoji as a confirmed permanent brand asset.

## Evidence on Hand

- Existing storefront: `https://sites.google.com/view/rockmanex/首頁`; the browser-rendered page exposed only the title, but the user supplied a 311×1336 mobile screenshot of the product list. It shows six coffee listings with origin/processing labels, roast dropdowns, half-pound options, prices (mostly $350, one $380), add-to-cart buttons, and a cart. Product names/descriptions are too small to transcribe reliably; do not guess exact catalog data.
- User-provided XLSX copy was inspected with OfficeCLI. Its `Products` sheet exposes 27 product rows (names, origin, bean, process, tasting notes, 0.5 lb and 1 lb prices); the workbook also contains existing customer/order records. Use the catalogue sheet only and keep the original workbook outside the project.
- Current inventory source: Google Sheet `https://docs.google.com/spreadsheets/d/1BxRlCcvVjLYEdhyIt2B7969k2i-kXKfwvviPFhLUi_g/edit?usp=drivesdk`, titled `老邱自家烘焙`. Read-only API access is verified. Only `Products!A1:B100` was read: 27 product names matched the catalog; 6 non-empty IDs (`p022`–`p027`) and 21 blank IDs. Do not read or expose the `Customers` or `Orders` tabs for storefront stock.
- The earlier spreadsheet ID `1BizaQ0-hODd3sxYiEJ2DFf2pRCZvu8msCi6UMKWHK0U` remains the intended order destination in the brief; it has not been confirmed or written to as part of this inventory task.
- The screenshot is real reference evidence for page structure and visible price ranges, not a reliable source for exact product copy.
- No verified product image assets, customer testimonials, or sales proof are available.

## Product Principles

1. Keep product, price, and fulfillment facts grounded in the owner's source data.
2. Make ordering straightforward on mobile and desktop.
3. Keep customer-submitted data private and only send it to an explicitly configured destination.
4. Make order status visible and manageable to the owner.
5. Never imply payment, inventory, or order persistence is live until it has been verified.
6. Keep the private source repository private; the rendered storefront may be public only after the owner confirms the launch-ready catalogue and order destination.
