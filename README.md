# Grocery Inventory App

**Quick grocery inventory management via barcode scanning.** Scan products, manage stock, sync to Airtable. Built for tablets/phones.

**🚀 Ready to launch?** See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for step-by-step deployment guide.

## Quick Start

**1. Install dependencies:**
```bash
pnpm install
```

> **pnpm not installed?** Enable it via `corepack` (recommended) or install globally:
> ```bash
> corepack enable pnpm
> corepack prepare pnpm@latest --activate
> # or: npm install -g pnpm
> ```
> If you can't install pnpm in your environment (e.g., minimal CI runners), use `npm` or `yarn` instead and remove `pnpm-lock.yaml` or generate a matching lockfile to avoid install conflicts.

**2. Set up environment:**
```bash
cp .env.example .env
# Edit .env and add your Airtable credentials
```

**3. Run locally (Nuxt):**
```bash
pnpm nuxi dev
```

**4. Deploy to production (Nuxt + Vercel):**
```bash
pnpm nuxi build               # Generate production build
pnpm nuxi preview             # Smoke-test the build locally (optional)
vercel                        # Deploy (see LAUNCH_CHECKLIST.md)
```

## Environment Variables

Required for both local and production:
- `VITE_AIRTABLE_API_KEY` - Your Airtable personal access token
- `VITE_AIRTABLE_BASE_ID` - Your Airtable base ID

**Never commit `.env` files.** They're gitignored by default.

## What This Does

1. **Scan** - Point camera at grocery barcode
2. **Lookup** - Auto-fetch product details from Airtable or AI
3. **Stock** - Add/remove inventory with IN/OUT buttons
4. **Track** - View current stock and movement history

## Tech Stack

- Nuxt 3 (Vue 3) + TypeScript + Vite
- TailwindCSS v4
- Airtable (backend)
- html5-qrcode (scanner)
- Vue Query (TanStack Query for Vue)
- PWA ready

## Documentation

- **[Launch Checklist](LAUNCH_CHECKLIST.md)** - Deploy to Vercel in 30 minutes
- **[Lean MVP Scope](docs/specs/mvp_scope_lean.md)** - What ships this week
- **[Full Docs](docs/README.md)** - Architecture, specs, guides
- **[CLAUDE.md](CLAUDE.md)** - Instructions for AI assistants

## MVP Status

✅ **Ready to ship** - All core features implemented:
- Barcode scanning with camera
- Product lookup and creation
- AI auto-fill (OpenFoodFacts)
- Stock IN/OUT management
- Movement history
- PWA support

🚧 **Post-MVP** (after validation):
- Backend proxy for Airtable security
- User authentication
- Offline PWA support
- Advanced observability

## Security Notice

**Current MVP approach:** Airtable credentials are in the client bundle. This is acceptable for initial validation with trusted testers.

**For production use:** Implement the backend proxy (see `docs/specs/backend_proxy.md`) before sharing widely.

Use Vercel's password protection feature to secure your deployment during MVP testing.
