# 🏗️ Project Architecture & Folder Structure (Production‑Ready)

This document contains a **complete, scalable architecture** for the Grocery Inventory App built with:
- React (Vite) or Next.js (compatible)
- TailwindCSS v4
- Shadcn UI
- Airtable backend
- PWA support
- Barcode scanning (html5-qrcode)

It is optimized for:
- Tablet/mobile-first UI
- Clean separation of concerns
- Future AI integrations
- Long-term maintainability

---

# 📁 1. Folder Structure (High-Level)

```
src/
 ├─ components/          # global UI + scanner + reusable widgets
 │    ├─ scanner/        # scanning logic
 │    └─ product/        # product management forms
 ├─ pages/               # top-level page components
 │    └─ ScanPage.tsx    # main entry point page
 ├─ lib/                 # external services & helpers
 │    ├─ airtable.ts     # airtable client
 │    └─ api.ts          # api functions (crud)
 ├─ hooks/               # shared hooks
 ├─ types/               # TS types
 ├─ assets/              # static assets
 ├─ main.tsx             # app entry
 └─ App.tsx              # root component
```

---

# 🧱 2. Detailed Folder Purpose & Best Practices

## **2.1 /components**
Components should be small, reusable, and **UI-focused**, never containing Airtable logic directly (use hooks/api).

Recommended structure:
```
components/
 ├─ scanner/
 │     └─ Scanner.tsx  # html5-qrcode component
 ├─ product/
 │     ├─ ProductDetail.tsx
 │     └─ CreateProductForm.tsx
```

### Purpose
- Keep UI isolated
- Keep scanner logic reusable
- Avoid duplication of stock buttons & product cards

---

## **2.2 /pages**
Encapsulates all screens of the app.

```
pages/
 └─ ScanPage.tsx       # Main page handling scan->lookup flow
```

### Purpose
- Handles high-level screen logic
- Calls API functions from `/lib`
- Assembles UI components from `/components`

---

## **2.3 /lib**
All business logic lives here.

Recommended structure:
```
lib/
 ├─ airtable.ts       # airtable client init
 └─ api.ts            # CRUD functions for products & stock
```

### Purpose
- Keep API logic out of components
- Centralize backend communication
- Make future migration to Supabase/Firebase trivial

---

## **2.4 /hooks**
Custom hooks that encapsulate reusable logic.

Recommended structure:
```
hooks/
 └─ useProductLookup.ts # manages lookup state + caching
```

### Purpose
- Improve code reuse
- Make component logic smaller and cleaner

---

## **2.5 /types**
Centralized TypeScript types.

```
types/
 └─ index.ts
```

### Example
```ts
export interface Product {
  id: string;
  name: string;
  barcode: string;
  category?: string;
  price?: number;
  expiryDate?: string;
  currentStock?: number;
}
```

---

## **2.6 /styles**
Contains TailwindCSS v4 imports + optional CSS resets.

### `/styles/index.css`
```css
@import "tailwindcss";
```

### Optional
```
styles/
 └─ globals.css
```

---

## **2.7 /assets**
PWA icons, splash screens, manifest images.

```
assets/
 ├─ icons/
 ├─ manifest.json
 └─ pwa-512.png
```

---

# 🧭 3. Recommended Routing Setup (React Router)

```
router.tsx
```
```tsx
import { createBrowserRouter } from "react-router-dom";
import ScanPage from "./pages/scan/ScanPage";
import AddProductPage from "./pages/add-product/AddProductPage";
import ProductDetailPage from "./pages/product/ProductDetailPage";

export const router = createBrowserRouter([
  { path: "/scan", element: <ScanPage /> },
  { path: "/add-product/:barcode", element: <AddProductPage /> },
  { path: "/product/:barcode", element: <ProductDetailPage /> },
]);
```

---

# 🏗️ 4. Core Architectural Principles

### ✔ Keep UI separate from logic
Components should never talk to Airtable directly.

### ✔ Keep Airtable calls in /lib
So backend migration is painless later.

### ✔ Keep scanning isolated
Scanner component should be standalone and pure.

### ✔ Keep AI optional but modular
AI helpers are imported only when needed.

### ✔ Everything should be PWA‑compatible
- Offline-first
- Fullscreen experience
- Single-page flow

---

# 📦 5. Final Architecture Diagram (Conceptual)

```
           +----------------------+
           |      React PWA       |
           |   (tablet frontend)  |
           +----------------------+
                     |
     +---------------+----------------+
     |                                |
+-----------+                  +---------------+
| Scanner   |                  | UI Components |
| html5-qrcode                | Shadcn + TW4  |
+-----------+                  +---------------+
     |                                |
     +----------------+---------------+
                      |
         +-------------------------+
         |     App Logic Layer     |
         |      (/lib folder)      |
         +-------------------------+
            |           |         |
     +------+      +----+----+   +------+
     |Airtable|    | AI Layer |   |Hooks |
     | Client |    | (naming, |   |(scan,|
     |        |    | pricing) |   |state) |
     +--------+    +----------+   +-------+
```

---

# ✅ Summary
This architecture gives you:
- A clean, scalable app structure
- Optimized tablet experience
- Easy future AI integration
- Airtable as a simple backend with swap‑out capability
- Low maintenance, high reliability

When you're ready, we move on to:
👉 **Option 3: Code Scaffolding for the entire MVP (Scanner, Pages, Airtable client, AI helpers).**

