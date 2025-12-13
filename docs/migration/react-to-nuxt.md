# React → Nuxt Migration Notes

Guidance for contributors updating the Grocery Inventory App from its original React/Vite stack to Nuxt 3. Use this as a changelog for defaults, scripts, and architectural expectations while the codebase transitions.

## Why Nuxt
- Server-first rendering pipeline with file-based routing and server routes for Airtable proxy work.
- Strong DX for TypeScript, Vue Query, and Vite-powered HMR.
- Predictable deployment path to Vercel with zero-config serverless rendering.

## Command Changes
| Purpose | React (old) | Nuxt (new) |
| --- | --- | --- |
| Install deps | `pnpm install` | `pnpm install` |
| Dev server | `pnpm dev` | `pnpm nuxi dev` |
| Prod build | `pnpm build` | `pnpm nuxi build` |
| Local preview | `pnpm preview` | `pnpm nuxi preview` |
| Lint | `pnpm lint` | `pnpm lint` (package.json scripts retained) |

## Framework & Library Swaps
- **App framework:** React 19 → Nuxt 3 (Vue 3).
- **Data fetching:** React Query → Vue Query (TanStack Query for Vue). Recreate hooks as composables in `composables/`.
- **Routing:** React Router → Nuxt file-system routes in `pages/`.
- **Stateful UI:** Replace React components with Vue SFCs using `<script setup>`; migrate contexts to Nuxt composables or plugins.
- **PWA setup:** Keep existing manifest/icons; move Vite PWA config into Nuxt modules when available.

## Deployment Notes
- Build with `pnpm nuxi build`; test locally via `pnpm nuxi preview` before deploying to Vercel.
- Vercel now detects Nuxt automatically; no custom build command needed beyond `pnpm nuxi build`.
- Server routes for Airtable proxy should live in `server/api/` instead of `/api` React adapters.

## Contributor Checklist
- Update documentation references from React to Nuxt as you touch files.
- Port shared utilities to `utils/` or `server/` as appropriate; avoid React-specific types.
- Recreate React Query mutations as Vue Query `useMutation` composables with proper invalidation keys.
- Validate camera and barcode scanning flows inside Nuxt layouts; adjust permissions prompts if layout-level guards differ.

## Known Gaps To Fill
- Nuxt module configuration for PWA and runtime config (`nuxt.config.ts`).
- Vue component rewrites for scanner, inventory tables, and dialogs.
- Automated tests need new runners (Vitest in Nuxt) once components are ported.
