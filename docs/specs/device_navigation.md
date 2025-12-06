# Device-Specific Navigation

**Version**: 1.0.0
**Status**: COMPLETE
**Owner**: TBD
**Last Updated**: 2026-01-20

## Overview

Mobile users are routed directly into scanning with a persistent Add/Remove toggle, while tablet users land on the Home screen with Add, Remove, and Checkout entry points.

## Behavior

- **Phone viewports (<768px)**: default to the scanner using the last-selected mode (Add or Remove). The mode persists in `localStorage` under `scannerMode`.
- **Tablet viewports (≥768px)**: load the Home screen and surface Add, Remove, and Checkout tiles. Checkout remains unavailable on smaller devices.
- **Mode toggle**: Available on the Scan page only for Add/Remove. The toggle is color-coded (emerald for Add, orange for Remove) and cannot expose Checkout.

## Changelog

### 1.0.0 (2026-01-20)
- Implemented viewport gating that routes phones to scanner and tablets to the Home screen.
- Added persistent mode badge/toggle on Scan page with color-coded Add/Remove modes.
- Documented that Checkout is intentionally tablet-only and hidden from mobile toggles.
