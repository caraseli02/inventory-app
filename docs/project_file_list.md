# 📁 Files Required to Start the Project

Below is the complete **file and folder list** you need to create inside your Vite + React + TypeScript project. This is the minimum required structure to get the Grocery Inventory MVP working.

You can create these files manually or copy/paste the structure into your editor.

---

# 🏗️ Root Structure
```
project-root/
 ├─ index.html
 ├─ package.json
 ├─ tsconfig.json
 ├─ vite.config.ts
 ├─ .env
 └─ src/
```

---

# 📁 Inside `src/`
```
src/
 ├─ main.tsx
 ├─ index.css
 ├─ App.tsx (Root Component)
 ├─ components/
 ├─ components/scanner/
 │    └─ Scanner.tsx
 ├─ components/product/
 │    ├─ CreateProductForm.tsx
 │    └─ ProductDetail.tsx
 ├─ pages/
 │    └─ ScanPage.tsx
 ├─ lib/
 │    ├─ ai/
 │    │    ├─ index.ts
 │    │    ├─ openFoodFacts.ts
 │    │    └─ types.ts
 │    ├─ api.ts
 │    └─ airtable.ts
 ├─ hooks/
 │    └─ useProductLookup.ts
 ├─ types/
 │    └─ index.ts
 ├─ assets/
 │    └─ react.svg
 └─ App.css
```

---

# 📄 Required Minimal Files
Below is the list of files you MUST have to run the MVP:

### Core
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`

### Scanner
- `src/components/scanner/Scanner.tsx`
- `src/pages/ScanPage.tsx`

### Airtable Backend
- `src/lib/airtable.ts`
- `src/lib/api.ts`

### Product Flows
- `src/components/product/CreateProductForm.tsx`
- `src/components/product/ProductDetail.tsx`

### Types
- `src/types/index.ts`

---

# 🎯 Files you can add later (not required for MVP):
- Additional Hooks
- AI Helpers
- PWA manifest & icons
- Shadcn components (if not already integrated)

---

# 🚀 How to Start the Project
After creating all required files:
```
npm install
npm run dev
```
Your app runs on:
```
http://localhost:5173
```
