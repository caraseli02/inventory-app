# Feature: xlsx Integration

**Version**: 1.0.0
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2025-12-12
**Dependencies**: [product_management.md], [stock_management.md]

## Overview

As a store owner
I want to import and export product data from Excel files
So that I can use my existing xlsx workflow for pricing while benefiting from the app's inventory tracking

## Background

The customer currently uses an Excel spreadsheet (`magazin.xlsx`) to:
- Track product purchases from suppliers
- Calculate transport costs
- Determine selling prices with different markup percentages (50%, 70%, 100%)

This feature integrates the xlsx workflow with the inventory app, allowing:
- Import products from xlsx (with pricing tiers)
- Export current inventory to xlsx
- Support multiple price tiers in the app

## xlsx Schema

### Required Columns

| Column | Header | Type | Required | App Field |
|--------|--------|------|----------|-----------|
| L | Cod de bare (Barcode) | Text | **Yes** | `Barcode` |
| B | Denumirea produsului | Text | **Yes** | `Name` |

### Optional Columns

| Column | Header | Type | App Field | Notes |
|--------|--------|------|-----------|-------|
| M | Categorie | Text | `Category` | Product category |
| H | Pret (euro) | Number | `Price` | Base price in EUR |
| I | Cost pret magazin 50% | Number | `price50` | 50% markup price |
| J | Cost pret magazin 70% | Number | `price70` | 70% markup price |
| K | Cost pret magazin 100% | Number | `price100` | 100% markup price |
| N | Stock curent | Number | `Current Stock Level` | Current inventory |
| O | Stock minim | Number | `Min Stock Level` | Reorder threshold |
| P | Furnizor | Text | `Supplier` | Supplier name |
| Q | Data expirare | Date | `Expiry Date` | ISO format (YYYY-MM-DD) |

### Sample File

Located at: `public/magazin.xlsx`
- 12 products with complete test data
- All columns populated with realistic values

---

## Feature: F021 - Excel Import

### Scenario: Import products from xlsx file

```gherkin
Given I am on the inventory list page
And I have an xlsx file with product data
When I click the "Import" button
And I select the xlsx file
Then I should see a preview of the products to import
And I can confirm or cancel the import
```

### Scenario: Preview data before import confirmation

```gherkin
Given I have selected an xlsx file for import
When the file is parsed
Then I should see a table showing:
  | Column | Value |
  | Barcode | Product barcode |
  | Name | Product name |
  | Category | Product category |
  | Price | Base price |
  | Stock | Current stock level |
And I can see the total number of products to import
And I can cancel the import
```

### Scenario: Handle duplicate barcode during import

```gherkin
Given I am importing products from xlsx
And a product with barcode "5901234567890" already exists in the database
When the import processes that product
Then I should see a warning about duplicate barcodes
And I can choose to:
  | Option | Action |
  | Skip | Don't import duplicates |
  | Update | Update existing product data |
  | Replace | Delete and recreate product |
```

### Scenario: Map xlsx columns to product fields correctly

```gherkin
Given I am importing an xlsx file
When the file is parsed
Then the following column mappings should be applied:
  | xlsx Column | App Field |
  | Cod de bare (Barcode) | Barcode |
  | Denumirea produsului | Name |
  | Categorie | Category |
  | Pret (euro) | Price |
  | Cost pret magazin 50% | price50 |
  | Cost pret magazin 70% | price70 |
  | Cost pret magazin 100% | price100 |
  | Stock curent | Current Stock Level |
  | Stock minim | Min Stock Level |
  | Furnizor | Supplier |
  | Data expirare | Expiry Date |
```

### Acceptance Criteria

- [ ] File upload component with drag & drop support
- [ ] xlsx parsing using SheetJS library
- [ ] Preview table showing parsed products
- [ ] Column mapping configuration (auto-detect + manual override)
- [ ] Duplicate handling (skip/update/replace options)
- [ ] Progress indicator during import
- [ ] Success/error toast notifications
- [ ] Import creates products in Airtable

---

## Feature: F022 - Excel Export

### Scenario: Export all products to xlsx

```gherkin
Given I am on the inventory list page
And there are products in the database
When I click the "Export" button
Then an xlsx file should be downloaded
And the file should contain all products
And the filename should be "inventory-YYYY-MM-DD.xlsx"
```

### Scenario: Exported file contains correct stock levels

```gherkin
Given I have products with stock movements recorded
When I export the inventory to xlsx
Then the "Stock curent" column should show current stock levels
And the values should match what's displayed in the app
```

### Scenario: Exported file contains pricing tiers

```gherkin
Given I have products with pricing tier data
When I export the inventory to xlsx
Then the file should include columns:
  | Column | Header |
  | H | Pret (euro) |
  | I | Cost pret magazin 50% |
  | J | Cost pret magazin 70% |
  | K | Cost pret magazin 100% |
```

### Acceptance Criteria

- [ ] Export button in inventory list header
- [ ] xlsx generation using SheetJS library
- [ ] Include all product fields
- [ ] Include current stock levels (calculated from movements)
- [ ] Include pricing tier columns
- [ ] Proper column formatting (numbers, dates)
- [ ] File downloads with timestamped filename

---

## Feature: F023 - Pricing Tiers Support

### Scenario: Display different price tiers for products

```gherkin
Given a product has pricing tier data:
  | Tier | Price |
  | Base | €4.35 |
  | 50% | €6.98 |
  | 70% | €7.91 |
  | 100% | €9.31 |
When I view the product detail
Then I should see the active price tier displayed
And I can see all available price tiers
```

### Scenario: Switch between price tiers

```gherkin
Given the app has a price tier setting
When I change the price tier to "70%"
Then all product prices should display the 70% markup price
And the checkout should use the 70% prices
```

### Scenario: Price tier persists across sessions

```gherkin
Given I have selected the "100%" price tier
When I close and reopen the app
Then the price tier should still be "100%"
And product prices should display at 100% markup
```

### Acceptance Criteria

- [ ] Add `price50`, `price70`, `price100` fields to Product type
- [ ] Store active price tier in localStorage
- [ ] Display active tier price in product views
- [ ] Price tier selector in app settings
- [ ] Checkout uses active tier prices
- [ ] Export includes all tier prices

---

## Technical Implementation

### Dependencies

```bash
pnpm add xlsx
```

### File Structure

```
src/
├── lib/
│   └── xlsx/
│       ├── index.ts           # Main xlsx service
│       ├── columnMapping.ts   # Column mapping configuration
│       ├── import.ts          # Import functions
│       └── export.ts          # Export functions
├── components/
│   └── xlsx/
│       ├── ImportDialog.tsx   # Import dialog with preview
│       ├── ExportButton.tsx   # Export button component
│       └── FileUpload.tsx     # Drag & drop file upload
└── types/
    └── index.ts               # Updated Product type with price tiers
```

### Updated Product Type

```typescript
interface Product {
  id: string;
  createdTime: string;
  fields: {
    Name: string;
    Barcode: string;
    Category?: string;
    Price?: number;           // Base price (EUR)
    price50?: number;         // 50% markup price
    price70?: number;         // 70% markup price
    price100?: number;        // 100% markup price
    'Expiry Date'?: string;
    'Current Stock Level'?: number;
    'Ideal Stock'?: number;
    'Min Stock Level'?: number;
    Supplier?: string;
    Image?: Array<{ url: string }>;
  };
}
```

### Column Mapping Configuration

```typescript
const COLUMN_MAPPING = {
  // Required fields
  'Cod de bare (Barcode)': 'Barcode',
  'Denumirea produsului': 'Name',

  // Optional fields
  'Categorie': 'Category',
  'Pret (euro)': 'Price',
  'Cost pret magazin 50%': 'price50',
  'Cost pret magazin 70%': 'price70',
  'Cost pret magazin 100%': 'price100',
  'Stock curent': 'Current Stock Level',
  'Stock minim': 'Min Stock Level',
  'Furnizor': 'Supplier',
  'Data expirare': 'Expiry Date',
};
```

---

## Future Phases

### Phase 2: Local-First Storage (Dexie.js)

Replace Airtable with IndexedDB using Dexie.js:
- Full offline support
- xlsx as backup/sync mechanism
- No internet required for basic operations

### Phase 3: Cloud Sync (Supabase)

Add optional cloud synchronization:
- Multi-device sync
- User authentication
- Real-time collaboration

---

## Changelog

### 1.0.0 (2025-12-12)
- Initial spec created
- Defined xlsx schema and column mapping
- Added scenarios for import, export, and pricing tiers
- Documented technical implementation plan
