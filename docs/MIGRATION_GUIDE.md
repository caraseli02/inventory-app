# Airtable to Supabase Migration Guide

Complete guide to migrating your existing inventory data from Airtable to Supabase.

**Estimated Time**: 30-45 minutes
**Risk Level**: Low (non-destructive, keeps Airtable data intact)

---

## Table of Contents

1. [Before You Begin](#1-before-you-begin)
2. [Set Up Supabase](#2-set-up-supabase)
3. [Export Data from Airtable](#3-export-data-from-airtable)
4. [Import Data to Supabase](#4-import-data-to-supabase)
5. [Switch Backend](#5-switch-backend)
6. [Verify Migration](#6-verify-migration)
7. [Rollback Plan](#7-rollback-plan)

---

## 1. Before You Begin

### Prerequisites

- ✅ Existing inventory app running with Airtable
- ✅ Node.js 18+ installed
- ✅ pnpm installed (`corepack enable pnpm`)
- ✅ Access to your Airtable workspace
- ✅ Supabase account created

### What Gets Migrated

✅ **Products** (all fields):
- Name, Barcode, Category, Price
- Price tiers (50%, 70%, 100%)
- Markup settings
- Stock thresholds (min, ideal)
- Supplier, Expiry Date
- Product images

✅ **Stock Movements**:
- All historical movements
- IN/OUT transaction types
- Quantities and dates

❌ **What Doesn't Get Migrated**:
- Airtable views and filters (app doesn't use them)
- Airtable comments (not used in app)
- Airtable automations (not used in app)

### Migration Strategy

This guide uses a **safe, non-destructive approach**:

1. Set up Supabase alongside Airtable
2. Export data from Airtable
3. Import data to Supabase
4. Test Supabase in development
5. Switch to Supabase in production
6. Keep Airtable as backup (optional)

**No data is deleted from Airtable during this process.**

---

## 2. Set Up Supabase

**If you haven't already**, follow the complete [Supabase Setup Guide](./SUPABASE_SETUP.md).

**Quick checklist**:
- [ ] Supabase project created
- [ ] Database schema created (products + stock_movements tables)
- [ ] API credentials obtained (URL + publishable key)

---

## 3. Export Data from Airtable

### Step 3.1: Export Products

1. Open your Airtable base
2. Go to the **Products** table
3. Click the **View** menu (top left)
4. Select **"Grid view"** (or your main view)
5. Click the **Download CSV** button (top right, next to "Share view")
6. Save as `products-export.csv`

### Step 3.2: Export Stock Movements

1. Still in your Airtable base
2. Go to the **Stock Movements** table
3. Click **Download CSV**
4. Save as `stock-movements-export.csv`

### Step 3.3: Save to Project

Place both CSV files in your project root:

```
inventory-app/
├── products-export.csv          ← Products data
├── stock-movements-export.csv   ← Stock movements data
├── package.json
└── ...
```

**⚠️ Important**: Don't commit these CSV files to git! Add them to `.gitignore`:

```bash
echo "products-export.csv" >> .gitignore
echo "stock-movements-export.csv" >> .gitignore
```

---

## 4. Import Data to Supabase

### Step 4.1: Create Migration Script

Create a new file: `scripts/migrate-airtable-to-supabase.ts`

```typescript
/**
 * Airtable to Supabase Migration Script
 *
 * Reads CSV exports from Airtable and imports them into Supabase.
 * Run with: pnpm tsx scripts/migrate-airtable-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Supabase credentials (from .env or hardcode for one-time migration)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'your_publishable_key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Airtable → Supabase field mapping
const PRODUCT_FIELD_MAP = {
  'Name': 'name',
  'Barcode': 'barcode',
  'Category': 'category',
  'Price': 'price',
  'Price 50%': 'price_50',
  'Price 70%': 'price_70',
  'Price 100%': 'price_100',
  'Markup': 'markup',
  'Expiry Date': 'expiry_date',
  'Min Stock Level': 'min_stock_level',
  'Ideal Stock': 'ideal_stock',
  'Supplier': 'supplier',
  'Image': 'image_url', // Will extract URL from attachment JSON
};

// Parse Airtable attachment field: [{"url": "https://..."}] → "https://..."
function parseImageUrl(imageField: string): string | null {
  if (!imageField) return null;
  try {
    const attachments = JSON.parse(imageField);
    return attachments[0]?.url || null;
  } catch {
    return null;
  }
}

// Parse numeric field (handles empty strings)
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Parse integer field
function parseInt(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const num = Number.parseInt(value, 10);
  return isNaN(num) ? null : num;
}

async function migrateProducts() {
  console.log('📦 Migrating products...');

  const csvContent = fs.readFileSync('products-export.csv', 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`Found ${records.length} products to migrate`);

  // Map: Airtable Record ID → Supabase UUID
  const productIdMap = new Map<string, string>();

  for (const record of records) {
    const productData = {
      name: record['Name'],
      barcode: record['Barcode'] || null,
      category: record['Category'] || null,
      price: parseNumber(record['Price']),
      price_50: parseNumber(record['Price 50%']),
      price_70: parseNumber(record['Price 70%']),
      price_100: parseNumber(record['Price 100%']),
      markup: parseInt(record['Markup']),
      expiry_date: record['Expiry Date'] || null,
      min_stock_level: parseInt(record['Min Stock Level']),
      ideal_stock: parseInt(record['Ideal Stock']),
      supplier: record['Supplier'] || null,
      image_url: parseImageUrl(record['Image']),
    };

    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select('id')
      .single();

    if (error) {
      console.error(`❌ Failed to import product "${record['Name']}":`, error.message);
      continue;
    }

    // Store mapping for stock movements
    productIdMap.set(record['Record ID'], data.id);
    console.log(`✅ Imported: ${record['Name']} (${record['Barcode'] || 'no barcode'})`);
  }

  console.log(`\n✅ Migrated ${productIdMap.size} products\n`);
  return productIdMap;
}

async function migrateStockMovements(productIdMap: Map<string, string>) {
  console.log('📊 Migrating stock movements...');

  const csvContent = fs.readFileSync('stock-movements-export.csv', 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`Found ${records.length} stock movements to migrate`);

  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    // Get linked product ID (Airtable stores this as array: ["recXYZ"])
    let airtableProductId: string;
    try {
      const productArray = JSON.parse(record['Product']);
      airtableProductId = productArray[0];
    } catch {
      console.warn(`⚠️ Skipping movement: invalid Product link`);
      skipped++;
      continue;
    }

    const supabaseProductId = productIdMap.get(airtableProductId);
    if (!supabaseProductId) {
      console.warn(`⚠️ Skipping movement: product not found (Airtable ID: ${airtableProductId})`);
      skipped++;
      continue;
    }

    const movementData = {
      product_id: supabaseProductId,
      quantity: parseInt(record['Quantity']) || 0,
      type: record['Type'] as 'IN' | 'OUT',
      date: record['Date'] || new Date().toISOString().split('T')[0],
    };

    const { error } = await supabase
      .from('stock_movements')
      .insert(movementData);

    if (error) {
      console.error(`❌ Failed to import movement:`, error.message);
      skipped++;
      continue;
    }

    imported++;
  }

  console.log(`\n✅ Migrated ${imported} stock movements`);
  if (skipped > 0) {
    console.log(`⚠️ Skipped ${skipped} movements (product not found or invalid data)`);
  }
}

async function main() {
  console.log('🚀 Starting Airtable → Supabase migration\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Step 1: Migrate products and build ID mapping
    const productIdMap = await migrateProducts();

    // Step 2: Migrate stock movements using ID mapping
    await migrateStockMovements(productIdMap);

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Supabase dashboard');
    console.log('2. Test app locally with Supabase backend');
    console.log('3. Deploy to production when ready');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
```

### Step 4.2: Install Dependencies

```bash
pnpm add -D tsx csv-parse
```

### Step 4.3: Run Migration

```bash
pnpm tsx scripts/migrate-airtable-to-supabase.ts
```

**Expected output**:
```
🚀 Starting Airtable → Supabase migration

📦 Migrating products...
Found 45 products to migrate
✅ Imported: Milk (1234567890)
✅ Imported: Bread (9876543210)
...
✅ Migrated 45 products

📊 Migrating stock movements...
Found 128 stock movements to migrate
✅ Migrated 128 stock movements

✅ Migration complete!
```

---

## 5. Switch Backend

### Step 5.1: Update Local Environment

Edit `.env`:

```bash
# ============================================
# Backend Configuration
# ============================================

# Supabase (primary backend) ✅
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Airtable (comment out to use Supabase)
# VITE_AIRTABLE_API_KEY=patAbcd1234567890...
# VITE_AIRTABLE_BASE_ID=appXyzAbcd1234567
```

### Step 5.2: Restart Development Server

```bash
pnpm dev
```

Check console logs:
```
📦 Using Supabase as database backend
```

✅ **Success!** Your app is now using Supabase locally.

---

## 6. Verify Migration

### Step 6.1: Check Product Count

1. Open app in browser
2. Navigate to inventory list
3. Verify product count matches Airtable

### Step 6.2: Check Stock Levels

1. Select a product
2. Verify current stock matches Airtable
3. Check stock movement history

### Step 6.3: Test Operations

1. **Create Product**: Add a new product
2. **Update Product**: Edit an existing product
3. **Stock IN**: Add stock to a product
4. **Stock OUT**: Remove stock from a product
5. **Delete Product**: Delete a test product

### Step 6.4: Verify in Supabase Dashboard

1. Go to Supabase → **Table Editor** → **products**
2. Verify your test operations appear

---

## 7. Rollback Plan

### If Something Goes Wrong

**Rollback is simple** - just switch back to Airtable:

1. Edit `.env`:
   ```bash
   # Comment out Supabase
   # VITE_SUPABASE_URL=...
   # VITE_SUPABASE_PUBLISHABLE_KEY=...

   # Uncomment Airtable
   VITE_AIRTABLE_API_KEY=patAbcd1234567890...
   VITE_AIRTABLE_BASE_ID=appXyzAbcd1234567
   ```

2. Restart dev server:
   ```bash
   pnpm dev
   ```

3. Verify console shows:
   ```
   📦 Using Airtable as database backend (legacy)
   ```

**Your Airtable data is untouched** - you can always roll back!

---

## Deploy to Production

### Step 1: Update Vercel Environment Variables

1. Go to Vercel → **Settings** → **Environment Variables**
2. Add Supabase credentials:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Remove** or comment out Airtable env vars:
   - `VITE_AIRTABLE_API_KEY`
   - `VITE_AIRTABLE_BASE_ID`

### Step 2: Deploy

```bash
vercel --prod
```

### Step 3: Verify Production

1. Open production URL
2. Check console: `📦 Using Supabase as database backend`
3. Test all features

---

## Post-Migration Cleanup

### Optional: Keep Airtable as Backup

You can keep Airtable data as a backup for 30-90 days:
- Don't delete Airtable base immediately
- Use it as fallback if issues arise
- After 90 days, archive or delete

### Optional: Clean Up Airtable Code

Once confident in Supabase, you can remove Airtable code:

1. Delete `src/lib/airtable.ts`
2. Delete `src/lib/api.ts`
3. Update `src/lib/api-provider.ts` to remove Airtable logic
4. Update `.env.example` to remove Airtable variables

**Recommendation**: Keep Airtable code for now - it's minimal overhead and provides flexibility.

---

## Troubleshooting

### Issue: Migration script fails with "Record ID not found"

**Solution**: Ensure your CSV export includes the "Record ID" column.

In Airtable:
1. Go to table view
2. Click **Fields** (top right)
3. Enable **Record ID** field
4. Re-export CSV

### Issue: Stock levels don't match Airtable

**Cause**: Stock movements might not have imported correctly.

**Solution**:
1. Check Supabase → **stock_movements** table
2. Verify quantity values are signed (negative for OUT)
3. Re-run migration script if needed:
   ```bash
   # Clear Supabase tables first
   # Then re-run migration
   pnpm tsx scripts/migrate-airtable-to-supabase.ts
   ```

### Issue: Images not showing up

**Cause**: Image URLs might be expired or Airtable attachment format not parsed correctly.

**Solution**:
1. Check `image_url` column in Supabase
2. Verify URLs are valid (not data URLs)
3. Consider re-uploading images via app's camera capture feature

---

## Support

- **Supabase Issues**: [Supabase Support](https://supabase.com/support)
- **App Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Migration Help**: Open a discussion on GitHub

---

## Success Checklist

- [ ] Supabase project set up
- [ ] Database schema created
- [ ] CSV exports downloaded from Airtable
- [ ] Migration script executed successfully
- [ ] All products imported
- [ ] All stock movements imported
- [ ] Stock levels match Airtable
- [ ] Local testing passed
- [ ] Production deployment successful
- [ ] All features working on Supabase

**🎉 Congratulations!** You've successfully migrated to Supabase.
