# Grocery Inventory App MVP – Detailed Checklist & Plan

## 🎯 Goal: A tablet-friendly PWA that scans barcodes, checks/creates products in Airtable, and manages stock IN/OUT.

---

## 🧱 PHASE 1 — PROJECT SETUP

### 1.1 Create project environment
- [ ] Install Node.js
- [ ] Run `npm create vite@latest inventory-app --template react-ts`
- [ ] Install dependencies:
  - [ ] `npm install html5-qrcode`
  - [ ] `npm install airtable`
  - [ ] `npm install axios`
  - [ ] `npm install @types/node -D`

### 1.2 Add TailwindCSS v4
- [ ] Install Tailwind v4: `npm install -D tailwindcss@latest`
- [ ] Generate config: `npx tailwindcss init`
- [ ] Use the new v4 `tailwind.config.js` format (no PostCSS needed)
- [ ] Add Tailwind’s base directives to your `src/index.css`:
  ```css
  @import "tailwindcss";
  ````

### 1.3 Project structure cleanup
- [ ] Create `/components` folder
- [ ] Create `/pages` folder
- [ ] Create `/lib` folder (Airtable helpers)
- [ ] Create `/types` folder

---

## 📸 PHASE 2 — SCANNER IMPLEMENTATION

### 2.1 Add Scanner component
- [ ] Create `Scanner.tsx` using html5-qrcode
- [ ] Configure fps=10, qrbox=250
- [ ] Add `onScan(barcode)` callback
- [ ] Stop scanning after first detection
- [ ] Test camera permission on tablet

### 2.2 Create Scan Page
- [ ] Add state: `barcode`, `isScanning`
- [ ] If no barcode → show scanner
- [ ] After scan → show result screen
- [ ] Add buttons: Scan Again / Continue

### 2.3 Tablet optimization
- [ ] Force back camera if possible
- [ ] Full-width scanner container
- [ ] Handle rotation

---

## 🗄️ PHASE 3 — AIRTABLE BACKEND SETUP

### 3.1 Create Airtable Base: Grocery Inventory
- [ ] Table: **Products**
  - [ ] Name
  - [ ] Barcode
  - [ ] Category
  - [ ] Price
  - [ ] Expiry Date
  - [ ] Image

- [ ] Table: **Stock Movements**
  - [ ] Product (link to Products)
  - [ ] Quantity (+/-)
  - [ ] Type (IN/OUT)
  - [ ] Date
  - [ ] Note

### 3.2 Add rollup for Current Stock
- [ ] In Products: `SUM(Stock Movements.Quantity)`

### 3.3 Create Airtable API keys
- [ ] Generate personal token
- [ ] Copy Base ID
- [ ] Store environment variables

---

## 🔗 PHASE 4 — AIRTABLE CRUD INTEGRATION

### 4.1 Create Airtable client helper
- [ ] `/lib/airtable.ts` with base init

### 4.2 Implement product lookup
- [ ] Function: `getProductByBarcode(barcode)`
- [ ] Use filter formula

### 4.3 Implement create product
- [ ] Function: `createProduct(data)`

### 4.4 Implement stock movement
- [ ] Function: `addStockMovement(productId, quantity)`

---

## 🔍 PHASE 5 — SCAN → LOOKUP FLOW

### 5.1 Implement routing logic
- [ ] After scan: call Airtable lookup
- [ ] If product exists → Product Detail
- [ ] If not → Create Product

### 5.2 Add loading states
- [ ] Spinner while checking Airtable

---

## 📝 PHASE 6 — CREATE PRODUCT SCREEN

### 6.1 Form fields
- [ ] Barcode (pre-filled)
- [ ] Name
- [ ] Category
- [ ] Price
- [ ] Expiry Date

### 6.2 AI helpers
- [ ] "AI Suggest Name"
- [ ] "AI Suggest Category"
- [ ] "AI Suggest Price"

### 6.3 Submit flow
- [ ] Validate
- [ ] Create in Airtable
- [ ] Redirect to Product Detail

---

## 📦 PHASE 7 — PRODUCT DETAIL + STOCK

### 7.1 Display product
- [ ] Name, price, expiry
- [ ] Current stock (rollup)

### 7.2 Stock adjustment
- [ ] Add Stock button → +1
- [ ] Remove Stock button → -1

### 7.3 Activity log
- [ ] Show last X stock movements

---

## 📱 PHASE 8 — PWA SETUP

### 8.1 Install Vite PWA plugin
- [ ] Add manifest.json
- [ ] App name, icons, colors

### 8.2 Enable install on tablet
- [ ] Test Add to Home Screen

### 8.3 Fullscreen mode
- [ ] Hide browser UI
- [ ] Standalone display mode

---

## 🔮 PHASE 9 — OPTIONAL AI FEATURES
- [ ] Auto-name products
- [ ] Auto-category detection
- [ ] Price suggestions
- [ ] Reorder predictions
- [ ] Vision: Identify product from photo

---

## 🧪 PHASE 10 — QA CHECKLIST

### Functional
- [ ] Scan multiple barcodes
- [ ] Add new products
- [ ] Adjust stock
- [ ] Check rollup correctness
- [ ] Test offline behavior

### Performance
- [ ] Scan speed (<1s)
- [ ] Airtable latency acceptable
- [ ] Tablet battery consumption

---

## 💥 PHASE 11 — MVP COMPLETE
- Camera-based scanner
- Airtable backend
- In/out stock control
- AI-assisted product creation
- Installable tablet PWA

Your MVP is ready for real grocery-store use.

