# Grocery Inventory App

**Quick grocery inventory management via barcode scanning.** Scan products, manage stock, sync to Supabase or Airtable. Built for tablets/phones.

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
# Edit .env and add your backend credentials (Supabase or Airtable)
```

**3. Run locally:**
```bash
pnpm dev
```

**4. Deploy to production:**
```bash
pnpm build                    # Test build
vercel                        # Deploy (see LAUNCH_CHECKLIST.md)
```

## Backend Configuration

**Choose your backend** - The app automatically detects which backend to use based on environment variables.

### Option 1: Supabase (Recommended) 🌟

**Why Supabase?**
- ✅ Open source & self-hostable
- ✅ Real-time subscriptions
- ✅ Built-in authentication
- ✅ Row Level Security (RLS)
- ✅ Free tier: 500MB database, 50,000 monthly active users

**Setup Guide**: See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for detailed instructions.

**Required Environment Variables:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

### Option 2: Airtable (Legacy)

**Note**: Airtable support is maintained for backward compatibility but Supabase is recommended for new projects.

**Required Environment Variables:**
```bash
VITE_AIRTABLE_API_KEY=your_airtable_personal_access_token
VITE_AIRTABLE_BASE_ID=your_airtable_base_id
```

**Migration**: Already using Airtable? See [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) to migrate to Supabase.

### Backend Priority

If both backends are configured, **Supabase takes priority**. To switch backends, simply set/unset the respective environment variables.

**Never commit `.env` files.** They're gitignored by default.

## What This Does

1. **Scan** - Point camera at grocery barcode
2. **Lookup** - Auto-fetch product details from Airtable or AI
3. **Stock** - Add/remove inventory with IN/OUT buttons
4. **Track** - View current stock and movement history

## Tech Stack

- React 19 + TypeScript + Vite
- TailwindCSS v4
- **Supabase** (recommended backend) or Airtable (legacy)
- html5-qrcode (scanner)
- React Query (data)
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

### Supabase (Recommended)
**Built-in security:** Supabase uses Row Level Security (RLS) policies to protect your data. The publishable key is safe to expose client-side.

**Best practice:** Configure RLS policies in your Supabase dashboard to restrict access based on user roles.

### Airtable (Legacy)
**Current approach:** Airtable credentials are in the client bundle. This is acceptable for initial validation with trusted testers.

**For production use:** Implement the backend proxy (see `docs/specs/backend_proxy.md`) before sharing widely, or migrate to Supabase.

**During testing:** Use Vercel's password protection feature to secure your deployment during MVP testing.
