# PWA Offline and Caching Strategy

**Version**: 0.2.0 (draft)
**Status**: POST_MVP (DEFERRED)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md) (POST_MVP)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

**⚠️ DEFERRED TO POST-MVP**: Advanced offline caching is not required for MVP. Online-only functionality is sufficient for validation with testers who have reliable internet. Implement offline support after confirming users actually need it.

## Objective
Extend the existing PWA setup with caching strategies that support offline resilience for the scanner flow and static assets.

## Scope
- Service worker configuration, asset caching, and offline UX for scan/create/update flows.

## MVP PWA Status (Currently Sufficient)

**Implemented for validation phase:**
- ✅ PWA manifest (`manifest.webmanifest`) with app metadata
- ✅ Service worker for basic asset caching (via vite-plugin-pwa)
- ✅ Installable as standalone app on mobile devices
- ✅ App icons for different platforms
- ✅ Auto-update capability (service worker regenerates on build)

**What's NOT implemented (deferred):**
- ❌ Offline data caching (API responses)
- ❌ Background sync for mutations while offline
- ❌ Offline queue for pending operations
- ❌ Stale-while-revalidate strategies
- ❌ Offline mode UI indicator
- ❌ Manual cache reset controls

**Why online-only is acceptable for MVP:**
- Testers have WiFi/cellular connectivity during testing
- Inventory management typically happens where internet is available (store/warehouse)
- Online-first is simpler and faster to validate
- Users will tell you if offline mode is a blocker
- 95% of use cases don't require offline functionality

## Why Deferred to Post-MVP

**Launch-planner rationale:**
1. **Does it serve the core user loop?** Not for most users - inventory management happens online
2. **Can you validate the idea without it?** Yes - online-only works for 95% of scenarios
3. **Is there a simpler version?** Yes - current PWA setup (already done)

**The trap we're avoiding:** Building complex offline sync for a feature nobody asked for.

**When to implement offline support:**
- **Trigger**: Users explicitly request it OR data shows users frequently lose connectivity during use
- **Timeline**: Week 6-10 after validation (after backend proxy is built)
- **Estimated effort**: 3-5 days (cache strategies + background sync + testing)
- **Prerequisite**: Backend proxy must exist (can't cache Airtable responses safely with client-side credentials)

**User research needed first:**
- Do testers actually lose connectivity while using the app?
- What % of inventory operations happen in areas with poor signal?
- Would they use the app differently if offline mode existed?

## Changelog

### 0.2.0 (2025-12-05)
- Updated status to POST_MVP with deferral rationale
- Added MVP PWA status section documenting current implementation
- Clarified that online-only is sufficient for validation phase
- Added prerequisite: backend proxy must exist before offline caching

### 0.1.0 (2025-12-05)
- Initial draft describing PWA offline objectives, scope, and dependencies

## Requirements
- Precache core static assets (HTML, JS, CSS, manifest, icons) with versioned cache naming.
- Runtime caching strategy for API calls with graceful offline behavior (e.g., stale-while-revalidate for reads; queue mutations when offline if feasible).
- Offline/low-connectivity UI that informs users when network is unavailable and what functionality is limited.
- Clear cache busting approach on deployment to avoid serving stale manifests.
- Monitoring hooks for service worker registration status and failures.

## Implementation Notes
- Evaluate Workbox or Vite PWA plugin options to add runtime caching rules and background sync (if permitted).
- Provide feature flag or environment toggle to disable offline queuing if not desired initially.
- Add manual “reset cache” option in a debug menu to assist with support issues.

## Acceptance Criteria
- Service worker caches core assets and provides an offline fallback page or message for the scan flow.
- API read calls use a defined runtime caching strategy; mutations either queue or fail gracefully with instructions.
- Offline/online transitions are detected and surfaced in the UI.
- Deployment instructions include how to test and invalidate PWA caches.
