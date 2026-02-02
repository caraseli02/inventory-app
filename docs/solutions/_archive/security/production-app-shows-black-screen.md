---
title: Production App Shows Black Screen
category: security
severity: HIGH
date: '2026-02-01'
tags: []
module: Unknown
related_github_issue: null
status: resolved
symptoms:
  - App loads but shows black screen
  - Console shows CSP (Content Security Policy) errors
  - All API calls fail with "Refused to connect" errors
  - Network tab shows blocked requests to api.airtable.com
commit: d39bb8f
---

# Problem Description
Production App Shows Black Screen

# Symptoms
*   App loads but shows black screen
*   Console shows CSP (Content Security Policy) errors
*   All API calls fail with "Refused to connect" errors
*   Network tab shows blocked requests to api.airtable.com


# Root Cause Analysis
The `vercel.json` file contained overly restrictive CSP headers that blocked essential API domains:

```json
// ❌ BEFORE (blocked Airtable)
"connect-src 'self' world.openfoodfacts.org"
```



# Solution
Updated `vercel.json` to allow all required domains:

```json
// ✅ AFTER (allows all needed APIs)
"connect-src 'self' https://api.airtable.com https://*.airtable.com https://world.openfoodfacts.org https://images.openfoodfacts.org"
```



# Files Changed
- `vercel.json` (line 8)



# Prevention
- Always test in production after deployment
- Check browser console for CSP violations
- Verify all external API domains are whitelisted in CSP

---



