# Supabase Setup Guide

Complete guide to setting up Supabase as your backend database for the Inventory App.

**Estimated Time**: 15-20 minutes

---

## Table of Contents

1. [Create Supabase Project](#1-create-supabase-project)
2. [Create Database Schema](#2-create-database-schema)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Test the Connection](#4-test-the-connection)
5. [Optional: Configure RLS Policies](#5-optional-configure-rls-policies)
6. [Deploy to Production](#6-deploy-to-production)

---

## 1. Create Supabase Project

### Step 1.1: Sign Up for Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign in"
3. Sign up with GitHub, Google, or email

### Step 1.2: Create a New Project

1. Click "New Project"
2. Fill in project details:
   - **Name**: `inventory-app` (or your preferred name)
   - **Database Password**: Generate a strong password (save this somewhere secure!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for development

3. Click "Create new project"
4. Wait 2-3 minutes for provisioning

### Step 1.3: Get Your API Credentials

Once the project is ready:

1. Go to **Settings** → **API** (left sidebar)
2. Find these two values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **`anon` `public`** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Note**: The "anon" key is also called the "publishable" key. It's safe to expose client-side.

⚠️ **Do NOT use the `service_role` key** - that's for server-side only and should never be exposed!

---

## 2. Create Database Schema

You need to create two tables: `products` and `stock_movements`.

### Step 2.1: Open SQL Editor

1. In your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click "New query"

### Step 2.2: Run This SQL Script

Copy and paste this entire script into the SQL Editor:

```sql
-- =====================================================
-- Inventory App - Database Schema
-- =====================================================
-- Creates tables for products and stock movements
-- Compatible with the app's existing data structure
-- =====================================================

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  price NUMERIC(10, 2),
  price_50 NUMERIC(10, 2),
  price_70 NUMERIC(10, 2),
  price_100 NUMERIC(10, 2),
  markup INTEGER CHECK (markup IN (50, 70, 100)),
  expiry_date DATE,
  min_stock_level INTEGER,
  ideal_stock INTEGER,
  supplier TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(date);

-- 4. Create updated_at trigger for products table
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Add comments for documentation
COMMENT ON TABLE public.products IS 'Stores product information including pricing tiers and inventory thresholds';
COMMENT ON TABLE public.stock_movements IS 'Tracks all stock movements (IN/OUT) for inventory management. Quantity is signed: positive for IN, negative for OUT';

COMMENT ON COLUMN public.products.markup IS 'Active markup percentage (50, 70, or 100). Determines which price tier is displayed';
COMMENT ON COLUMN public.products.price_50 IS 'Price with 50% markup';
COMMENT ON COLUMN public.products.price_70 IS 'Price with 70% markup';
COMMENT ON COLUMN public.products.price_100 IS 'Price with 100% markup';
COMMENT ON COLUMN public.products.min_stock_level IS 'Minimum stock level before triggering low stock alert';
COMMENT ON COLUMN public.products.ideal_stock IS 'Ideal stock level for reordering';

COMMENT ON COLUMN public.stock_movements.quantity IS 'Signed quantity: positive for IN movements, negative for OUT movements';
COMMENT ON COLUMN public.stock_movements.type IS 'Movement type: IN (receiving stock) or OUT (selling/removing stock)';

-- 6. Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE 'Tables created: products, stock_movements';
  RAISE NOTICE 'Indexes created for optimal query performance';
  RAISE NOTICE 'Next: Configure your environment variables';
END
$$;
```

### Step 2.3: Execute the Query

1. Click "Run" or press `Ctrl+Enter` (Cmd+Enter on Mac)
2. Wait for confirmation: "Success. No rows returned"
3. You should see a success notice at the bottom

### Step 2.4: Verify Tables Were Created

1. Go to **Table Editor** (left sidebar)
2. You should see two tables:
   - `products` (15 columns)
   - `stock_movements` (6 columns)

---

## 3. Configure Environment Variables

### Step 3.1: Local Development

1. In your project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```bash
   # ============================================
   # Backend Configuration - Choose ONE option
   # ============================================

   # Option 1: Supabase (Recommended) ✅
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # Option 2: Airtable (Legacy - comment out if using Supabase)
   # VITE_AIRTABLE_API_KEY=patAbcd1234567890...
   # VITE_AIRTABLE_BASE_ID=appXyzAbcd1234567
   ```

3. Replace `xxxxxxxxxxxxx.supabase.co` with your **Project URL**
4. Replace `eyJhbGciO...` with your **anon/publishable key**

### Step 3.2: Production (Vercel)

If deploying to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these two variables:
   - **Name**: `VITE_SUPABASE_URL`
     - **Value**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Name**: `VITE_SUPABASE_PUBLISHABLE_KEY`
     - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Select environment: **Production**, **Preview**, **Development**
5. Click "Save"

---

## 4. Test the Connection

### Step 4.1: Start the Development Server

```bash
pnpm dev
```

### Step 4.2: Check Console Logs

Open your browser console (F12) and look for:

```
📦 Using Supabase as database backend
```

If you see this, the backend is configured correctly! ✅

### Step 4.3: Create a Test Product

1. Navigate to the app in your browser
2. Create a new product:
   - Name: "Test Product"
   - Barcode: "1234567890"
   - Price: 5.99
3. Click "Save"

### Step 4.4: Verify in Supabase Dashboard

1. Go to **Table Editor** → **products**
2. You should see your test product!

If you see the product in Supabase, **you're all set!** 🎉

---

## 5. Optional: Configure RLS Policies

Row Level Security (RLS) policies protect your data. For MVP testing, you can skip this step and enable RLS later.

### When to Enable RLS

- **Skip for now**: If testing with trusted users only
- **Enable before public launch**: When opening to untrusted users
- **Enable with authentication**: When adding user login

### Basic RLS Policy (Public Access)

If you want to enable RLS now but allow all access:

```sql
-- Enable RLS on both tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Allow all operations (equivalent to no RLS)
CREATE POLICY "Allow all access to products"
  ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to stock_movements"
  ON public.stock_movements
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### Advanced RLS (With Authentication)

For production with user authentication:

```sql
-- Only allow authenticated users
CREATE POLICY "Authenticated users can manage products"
  ON public.products
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage stock movements"
  ON public.stock_movements
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 6. Deploy to Production

### Step 6.1: Update Environment Variables

Ensure your Vercel environment variables are set (see [Step 3.2](#step-32-production-vercel))

### Step 6.2: Deploy

```bash
# Build locally to test
pnpm build

# Deploy to Vercel
vercel --prod
```

### Step 6.3: Verify Production

1. Visit your production URL
2. Open console and check for: `📦 Using Supabase as database backend`
3. Test creating a product

---

## Troubleshooting

### Issue: "Missing Supabase credentials" error

**Solution**: Check that both env vars are set:
```bash
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_PUBLISHABLE_KEY
```

If empty, make sure:
- `.env` file exists in project root
- Env vars start with `VITE_` prefix
- Dev server was restarted after changing `.env`

### Issue: "Failed to fetch" or network errors

**Solution**:
1. Check your Supabase project URL is correct
2. Verify the project is active in Supabase dashboard
3. Check browser console for CORS errors

### Issue: App still using Airtable

**Solution**: Supabase takes priority only if `VITE_SUPABASE_URL` is set.

Check console logs:
- ✅ `📦 Using Supabase as database backend`
- ❌ `📦 Using Airtable as database backend (legacy)`

If using Airtable, unset Airtable env vars:
```bash
# In .env, comment out Airtable credentials
# VITE_AIRTABLE_API_KEY=...
# VITE_AIRTABLE_BASE_ID=...
```

Restart dev server: `pnpm dev`

### Issue: Permission denied / RLS policy errors

**Solution**: If you enabled RLS, make sure policies allow the operations you're trying.

To temporarily disable RLS for testing:
```sql
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
```

---

## Next Steps

✅ **Setup Complete!** Your app is now using Supabase.

**Optional enhancements**:
1. **Enable RLS policies** for production security
2. **Add user authentication** with Supabase Auth
3. **Set up backups** in Supabase dashboard
4. **Configure real-time subscriptions** for live updates
5. **Add database functions** for complex queries

**Need help?** Check the [Supabase documentation](https://supabase.com/docs) or [open an issue](https://github.com/your-repo/issues).

---

## Useful Links

- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
