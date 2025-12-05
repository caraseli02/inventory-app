# Walkthrough - Grocery Inventory App MVP

## Overview
The Grocery Inventory App MVP is a tablet-friendly PWA designed to streamline stock management. It features a built-in barcode scanner, Airtable integration for backend data, and a "Premium" dark-mode UI.

## Features Implemented

### 1. Barcode Scanning
- **Scanner Component**: Uses `html5-qrcode` to detect barcodes (UPC/EAN).
- **Behavior**: Auto-stops on detection and routes to lookup.

### 2. Product Management
- **Lookup**: Queries Airtable for existing products.
- **Create New**: Form to add new items (Name, Category, Price) if detection fails.
- **Stock Control**: Real-time +/- stock adjustments with Visual feedback.

### 3. PWA & UI
- **Tech**: Vite PWA plugin installed with full Manifest.
- **Design**: "Slate & Emerald" dark theme using Tailwind CSS v4.
- **Feedback**: Loading skeletons, spinners, and toast-like status updates.

## Verification
- **Build**: Passes `tsc` and `vite build`.
- **Linting**: Codebase is clean (minor unused variable warnings in Scanner handled).

## How to Test
1. **Configure Environment**:
   - Create `.env` with `VITE_AIRTABLE_API_KEY` and `VITE_AIRTABLE_BASE_ID`.
2. **Run Locally**:
   ```bash
   npm run dev
   ```
3. **Simulate Scan**:
   - Since webcam is required, you can inspect the `Scanner` component or test on a real device via network (e.g., `npm run dev -- --host`).

## Next Steps
- Real device testing on Tablet.
- Add "Recent Activity" log (Phase 7.3 deferred).
- Implement AI features (Phase 9).
