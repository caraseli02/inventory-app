# Project Status

Last updated: 2026-03-29

## Current branch focus

PR #183 updates Excel import so it remains a safe fallback when invoice intake hits edge cases.

Delivered in this branch:
- canonical Excel template path only
- required `Barcode` + `Name` columns
- barcode-only matching
- explicit preview actions: `create`, `update`, `receive_stock`, `skip`
- batch-level Excel idempotency for stock receipts
- import dialogs only mark complete on a clean runner result

## Validation status

Completed on branch:
- `pnpm typecheck`
- `pnpm lint`
- targeted Excel parser/preview/idempotency/runner tests
- invoice dialog flow test alignment
- browser verification for `/inventory` import entry

## Merge context

Residual risk is concentrated in CI parity for the new Excel parser batch hashing path and in the larger-than-normal PR size caused by shipping the fallback flow, tests, docs, and follow-up import UI contract fix together.
