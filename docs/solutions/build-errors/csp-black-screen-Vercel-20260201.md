---
module: VercelConfig
date: 2026-02-01
problem_type: build_error
component: build_config
symptoms:
  - App loads but shows black screen
  - Console shows CSP (Content Security Policy) errors
  - All API calls fail with "Refused to connect" errors
  - Network tab shows blocked requests to api.airtable.com
root_cause: csp_violation
resolution_type: config_change
severity: high
tags: [csp, vercel, security, production, airtable]
related_github_issue: null
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

- [x] Document all required API domains in vercel.json comments
- [ ] Always test in production after deployment (see Pattern 3 in critical-patterns.md)
- [ ] Check browser console for CSP violations
- [ ] Verify all external API domains are whitelisted in CSP
