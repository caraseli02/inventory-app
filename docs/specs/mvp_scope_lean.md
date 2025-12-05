# Lean MVP Scope - Ship This Week

**Version**: 1.0.0 (SHIP NOW)
**Status**: READY TO LAUNCH
**Owner**: TBD
**Launch Deadline**: Friday, 2025-12-06
**Last Updated**: 2025-12-05

## The One-Week Rule

If it's not required to validate the core user loop with real users, it's out of scope.

## Core User Loop (Already Built ✅)

1. Scan or enter a barcode
2. If product exists → view details + adjust stock
3. If product is new → create product (with AI suggestions) + add initial stock
4. Repeat

**Status**: This loop is 100% functional in the current codebase.

## What Ships This Week ✅

Everything below is already implemented and working:

### Core Features (COMPLETE)
- [x] Barcode scanning with html5-qrcode
- [x] Camera permission error handling
- [x] Product lookup by barcode
- [x] Create new products with form
- [x] AI auto-fill from OpenFoodFacts (name, category, image)
- [x] Stock IN/OUT movements
- [x] Current stock display (Airtable rollup)
- [x] Stock movement history (last 10)
- [x] Optimistic UI updates
- [x] Large quantity safety confirmation (50+ items)

### Technical Requirements (COMPLETE)
- [x] Client-side Airtable integration
- [x] React Query for data management
- [x] PWA support (service worker, manifest)
- [x] Production build working
- [x] TypeScript without errors
- [x] Responsive tablet/mobile UI

### Basic Validation (COMPLETE)
- [x] HTML5 input validation (min, type="number")
- [x] Non-negative quantity checks
- [x] User confirmation for large operations

### Basic Error Handling (COMPLETE)
- [x] Camera permission denied → error message
- [x] Network failures → alert with error message
- [x] Optimistic update rollback on API failure

## Explicitly OUT of MVP (Do After Validation)

The following are deferred until you have 1+ users who use the app for 3+ consecutive days:

### Infrastructure (NOT NEEDED YET)
- ❌ Backend proxy for Airtable (client-side is fine for validation)
- ❌ Comprehensive input sanitization (HTML5 + basic checks is enough)
- ❌ Formula injection protection (Airtable handles this)
- ❌ Rate limiting
- ❌ Server-side validation
- ❌ Proper authentication system

### Observability (NOT NEEDED YET)
- ❌ Logging infrastructure beyond console.log
- ❌ Error tracking service (Sentry, etc.)
- ❌ Analytics/metrics dashboard
- ❌ Performance monitoring

### Operations (NOT NEEDED YET)
- ❌ Comprehensive runbook documentation
- ❌ Rollback procedures
- ❌ Monitoring alerts
- ❌ Backup/restore procedures

### Features (NOT NEEDED YET)
- ❌ PWA offline caching (online-only first)
- ❌ Manual barcode entry fallback
- ❌ Multiple user accounts
- ❌ User permissions/roles
- ❌ Advanced search/filtering
- ❌ Bulk operations
- ❌ Export functionality
- ❌ Reports/analytics

### Polish (NOT NEEDED YET)
- ❌ Perfect UI/UX
- ❌ Custom loading animations
- ❌ Detailed onboarding
- ❌ Help documentation
- ❌ Keyboard shortcuts

## Launch Requirements (Must Complete by Friday)

### Deployment
- [ ] Deploy to Vercel (free tier, takes 5 minutes)
- [ ] Set environment variables in Vercel dashboard
- [ ] Test deployed app with real barcode scan

### Documentation (Minimal)
- [ ] Update README with:
  - What the app does (2 sentences)
  - How to set env vars
  - How to run locally
- [ ] Basic setup instructions for new users

### Validation Setup
- [ ] Identify 2-3 people who will test in week 1
- [ ] Share deployed URL with testers
- [ ] Set calendar reminder to check usage on 2025-12-12

## Success Metrics

**Week 1 Goal:** 1+ users scans at least 5 products on 3+ different days

If this happens → idea is validated → invest in hardening (backend proxy, etc.)
If this doesn't happen → pivot or kill → good thing we didn't build infrastructure!

## Security Posture for MVP

**Acceptable risks for validation phase:**
- ✅ Airtable credentials in client bundle (only you have access to the deployed URL)
- ✅ No user authentication (share URL only with trusted testers)
- ✅ Basic validation only (Airtable provides data integrity)
- ✅ Client-side logging only (you'll see errors in browser console if needed)

**Non-negotiable:**
- ✅ Don't commit .env file with real credentials
- ✅ Don't share the deployed URL publicly
- ✅ Use Vercel's password protection feature if sharing more widely

## Post-MVP Roadmap (Only if validated)

**Week 2 (If week 1 succeeds):**
- Gather feedback from testers
- Fix critical bugs
- Add most-requested small feature

**Week 3-4 (If usage continues):**
- Implement backend proxy
- Add proper authentication
- Improve observability

**Month 2+ (If product-market fit is clear):**
- Offline PWA support
- Advanced features
- Scale infrastructure

## Why This Scope?

**The trap you were falling into:** Building enterprise-grade infrastructure for a product with zero validated users.

**The lean approach:** Ship the working product you already have, validate with real users, then earn the right to build infrastructure.

**What changed:** Nothing in the code. Everything in the mindset.

## Changelog

### 1.0.0 (2025-12-05)
- Initial lean MVP scope focused on shipping by Friday
- Acknowledged all core features are already complete
- Deferred all infrastructure work until post-validation
