---
title: Black Screen After Deployment (Chunk Load Failed)
category: infrastructure
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - App works locally but shows black screen in production
  - 'Console shows "ChunkLoadError: Loading chunk X failed"'
  - 'Error: "Failed to fetch dynamically imported module"'
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
- Always test in production after code-split changes
- Monitor for ChunkLoadError in production logs
- Consider versioning strategy for critical apps

---



