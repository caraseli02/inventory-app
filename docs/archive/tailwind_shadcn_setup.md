# TailwindCSS v4 + Shadcn Setup (Updated 2025 Workflow)

> **Status**: Archived (historical setup notes kept for reference only).

This is the correct, copy‑ready setup for using **TailwindCSS v4** and **Shadcn UI** in a modern React/Vite project.

---

## 🎨 PHASE 1 — TailwindCSS v4 Setup

### ✔ What’s new in Tailwind v4?
- No PostCSS needed
- No Autoprefixer
- No `content` array configuration
- Simpler config
- Active immediately after CSS import

### **1. Install Tailwind v4**
- [ ] Run:
```
npm install -D tailwindcss@latest
```

### **2. Generate Tailwind config**
- [ ] Run:
```
npx tailwindcss init
```
This creates a minimal `tailwind.config.js`.

### **3. Import Tailwind into your global CSS**
- [ ] In `src/index.css` add:
```css
@import "tailwindcss";
```

Done — TailwindCSS v4 is active.

---

## 🎛 PHASE 2 — Shadcn Setup (Updated for Tailwind v4)

Shadcn UI now supports Tailwind v4 natively.

### **1. Initialize Shadcn**
- [ ] Run:
```
npx shadcn-ui@latest init
```
- The CLI will detect Tailwind v4 automatically.

### **2. CLI Prompts**
- CSS file path → `src/index.css`
- Base color → `zinc` (recommended)
- Alias → `@/components` (recommended)

### **3. Add your first UI component**
- [ ] Run:
```
npx shadcn-ui@latest add button
```
This generates:
- `/components/ui/button.tsx`
- Required Tailwind tokens

### **4. Import and use**
```tsx
import { Button } from "@/components/ui/button";

<Button>Click me</Button>
```

---

## 📱 Notes for Grocery Inventory Project

- Tailwind v4 keeps CSS extremely light
- Shadcn ensures consistent mobile/tablet UI
- Great for scanner screen layout
- Ideal for buttons like “Add Stock” / “Remove Stock”
- Clean form styling for Add Product page

---

## ✔ Summary
You now have:
- TailwindCSS v4 fully working
- Shadcn UI configured
- Ready to build scanner + product UI with consistent styling

