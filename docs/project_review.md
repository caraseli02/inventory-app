# Project Review - Grocery Inventory App

## Executive Summary
- The app delivers a single-page barcode-to-inventory flow (scan → lookup → create or adjust stock) with polished UI styling, React Query caching, and PWA metadata already wired in Vite.
- Critical risk: the Airtable API is called directly from the browser, meaning any deployed build would expose the secret API key and allow public modification of inventory data. A server-side proxy or backend service is required before production.
- Core grocery scenarios are mostly scaffolded, but production readiness gaps remain around security, validation, resilience, and documentation/testing.

## Architecture & Dependencies
- React + Vite with React Query for data fetching and caching, Tailwind v4 for styling, and html5-qrcode for scanning. The QueryClient is provided at the app root for global caching.【F:src/main.tsx†L1-L14】【F:src/components/scanner/Scanner.tsx†L1-L74】
- Airtable client is initialized in the frontend using Vite env vars and exported for use in the data-access layer. Table names are centralized.【F:src/lib/airtable.ts†L3-L20】
- Data-access functions perform lookup, creation, and stock movement CRUD directly against Airtable, with optimistic stock updates handled in the ProductDetail component via React Query.【F:src/lib/api.ts†L4-L89】【F:src/components/product/ProductDetail.tsx†L11-L98】

## Feature Coverage vs Specs
- Barcode scanning: Camera-based scanning with supported formats and manual entry fallback are implemented; basic error overlay exists but no explicit permission-denied UX.【F:src/components/scanner/Scanner.tsx†L8-L69】【F:src/pages/ScanPage.tsx†L42-L82】
- Product lookup & creation: A scanned/entered code triggers Airtable lookup; missing products show a create form with prefilled barcode, category/price/expiry inputs, and optional initial stock movement.【F:src/pages/ScanPage.tsx†L8-L71】【F:src/components/product/CreateProductForm.tsx†L1-L113】
- Stock management: Product detail view displays core fields, current stock, recent movements, and +/- buttons that optimistically mutate stock and refetch history. Aligns with “Add/Remove” scenarios.【F:src/components/product/ProductDetail.tsx†L11-L138】
- PWA: Manifest and assets are registered via vite-plugin-pwa with standalone display settings. Offline/response strategies are not configured yet.【F:vite.config.ts†L1-L38】

## Risks & Gaps
1) **Secret exposure & unrestricted writes** – Airtable API key and base ID are injected into the client bundle; all CRUD calls happen in-browser, enabling any user to read/write inventory data if the app ships. A backend proxy with row-level authorization is mandatory.【F:src/lib/airtable.ts†L3-L20】【F:src/lib/api.ts†L4-L89】
2) **Formula injection surface** – `filterByFormula` interpolates unsanitized barcodes, allowing crafted codes to alter Airtable queries. Input should be sanitized/parameterized server-side.【F:src/lib/api.ts†L4-L21】
3) **Error handling gaps** – Scanner silently swallows camera errors; product lookups only show a generic “Error connecting to DB”; stock mutations use `alert` for failures, leaving no durable UI state.【F:src/components/scanner/Scanner.tsx†L31-L69】【F:src/pages/ScanPage.tsx†L18-L69】【F:src/components/product/ProductDetail.tsx†L23-L63】
4) **Validation & resilience** – Manual barcode entry allows any string length ≥4 with no format checks; Create form lacks guards for negative prices/stock; network/loading states are minimal outside the primary flow.【F:src/pages/ScanPage.tsx†L32-L72】【F:src/components/product/CreateProductForm.tsx†L12-L112】
5) **Documentation & testing debt** – README remains the default Vite template and there are no automated tests or lint checks configured for CI; failed lint/test commands will be hard to trace.【F:README.md†L1-L52】

## Recommendations (Priority-Ordered)
1) Introduce a minimal backend proxy (e.g., serverless function) that handles Airtable auth, input sanitization, and role-based access; remove Airtable credentials from the client bundle.
2) Add robust error/permission UX for the scanner (camera-denied state), network failures, and stock mutations; replace `alert` with inline toasts/banners.
3) Harden input validation: barcode format checks (EAN/UPC), numeric validation for price/stock, and guardrails for expiry dates.
4) Expand observability: structured logging around API calls, and React Query error boundaries to surface failures.
5) Update README with setup/run steps, environment requirements, and known limitations; add lint/test scripts to CI once tooling is available.
6) Extend PWA setup with service worker caching strategies for static assets and offline-friendly fallback screens.
