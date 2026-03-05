---
module: Vercel
date: 2026-03-05
problem_type: build_error
component: build_config
symptoms:
  - "Vercel build fails: conflicting paths api/lib/twilio-signature.js vs api/lib/twilio-signature.ts"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags: [vercel, build, serverless, typescript]
related_github_issue: null
commit: "615572f"
---

# Problem Description

Vercel build failed with:

> Two or more files have conflicting paths or names… The path "api/lib/twilio-signature.js" has conflicts with "api/lib/twilio-signature.ts".

This blocks deployments entirely.

# Symptoms

- Vercel deploy logs error out during `vercel build`.
- The conflict is specifically when both `.js` and `.ts` exist for the same path segment under `api/`.

# Root Cause Analysis

Vercel’s build pipeline for serverless functions treats path segments (without extension) as unique. Having both:
- `api/lib/twilio-signature.js`
- `api/lib/twilio-signature.ts`

creates a “duplicate route/module path” conflict during bundling.

# Solution

- Keep a single implementation file for the module path.
- Deleted `/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.ts` and kept the existing `.js` (since `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` imports `.js`).

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.ts` (deleted)

# Prevention

- [ ] Add a CI check that fails if both `.ts` and `.js` exist with same basename under `api/`.
- [ ] Prefer one canonical source format for serverless modules (either all `.ts` compiled by bundler, or all `.js`).

