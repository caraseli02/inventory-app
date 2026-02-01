---
module: PWA
date: 2026-02-01
problem_type: build_error
component: pwa_config
symptoms:
  - App works locally but shows black screen in production
  - 'Console shows "ChunkLoadError: Loading chunk X failed"'
  - 'Error: "Failed to fetch dynamically imported module"'
root_cause: config_error
resolution_type: environment_setup
severity: high
tags: [pwa, service-worker, vite, code-splitting, deployment]
related_github_issue: null
commit: 5785aa1
---

# Problem Description
Black Screen After Deployment (Chunk Load Failed)

# Symptoms
*   App works locally but shows black screen in production
*   Console shows "ChunkLoadError: Loading chunk X failed"
*   Error: "Failed to fetch dynamically imported module"


# Root Cause Analysis
PWA service worker was caching old JavaScript chunks. When new code was deployed:
1. Vite created new chunk filenames (e.g., `ScanPage-XYZ789.js`)
2. Service worker still referenced old chunks (e.g., `ScanPage-ABC123.js`)
3. Browser tried to load non-existent chunks → Black screen



# Solution



# Files Changed
- `src/App.tsx` (lines 11-34)
- `vite.config.ts` (lines 81-86)



# Prevention

- [x] Configure vite-plugin-pwa to clear old caches on update
- [x] Add window.location.reload() on ChunkLoadError
- [ ] Always test in production after code-split changes
- [ ] Monitor for ChunkLoadError in production logs
- [ ] Consider versioning strategy for critical apps
