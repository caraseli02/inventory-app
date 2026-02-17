---
title: "fix: iOS PWA stale-version update reliability"
type: fix
date: 2026-02-17
---

# fix: iOS PWA stale-version update reliability

## Overview
Found brainstorm from 2026-02-17: `docs/brainstorms/2026-02-17-ios-pwa-update-reliability-brainstorm.md`. Using it as planning context.

Goal: stop iPad users from getting stuck on old app builds after deployment, without interrupting active inventory flows.

Chosen direction:
- Show update modal when a new version is detected.
- Trigger modal immediately on detection.
- Add manual "Reset app cache / force refresh" fallback.

## Problem Statement / Motivation
Current PWA setup already includes `autoUpdate`, `skipWaiting`, `clientsClaim`, and cache cleanup, but users still report stale versions on iOS home-screen installs.

Impact:
- QA confusion (incognito needed to verify latest build)
- support friction
- risk of running old UI/business logic in production

## Local Research Notes (What Exists Today)
- PWA plugin/update settings: `vite.config.ts:63`, `vite.config.ts:112`, `vite.config.ts:114`, `vite.config.ts:116`
- Chunk-load recovery via forced reload fallback: `src/lib/lazyWithRetry.ts:15`, `src/lib/lazyWithRetry.ts:22`
- Prior incident + prevention notes: `docs/solutions/build-errors/chunk-load-failed-PWA-20260201.md:27`, `docs/solutions/build-errors/chunk-load-failed-PWA-20260201.md:47`
- Existing deployment troubleshooting mentions manual SW/cache clear: `docs/DEPLOYMENT.md:196`, `docs/DEPLOYMENT.md:200`
- PWA spec explicitly lists missing manual reset control: `docs/specs/pwa_offline.md:33`, `docs/specs/pwa_offline.md:83`

## Proposed Solution
1. Implement explicit service-worker update signal in app shell.
2. Display a blocking modal when update is available.
3. Modal actions:
   - `Update now` (activate new worker + reload)
   - `Later` (dismiss for current session)
4. Add a user-accessible cache reset action (Settings/Debug) that unregisters service workers, clears caches, and reloads.
5. Add iOS-specific validation checklist for Safari + installed PWA behavior.

## Technical Considerations
- iOS can delay worker lifecycle and aggressively cache resources; UX controls are required even with correct Workbox config.
- Avoid auto-reload during critical operations (camera active, checkout confirmation). If update arrives then, queue modal until safe point.
- Ensure modal copy is explicit: “A new version is ready.”
- Keep solution focused on update reliability; do not expand into full offline queue/sync in this issue.

## SpecFlow (User Flows + Edge Cases)
### Happy Paths
- User has old build open; new deployment happens; modal appears; user taps update; app reloads into latest build.
- User dismisses once; continues session; sees latest on next manual refresh/open.
- User hits manual cache reset; app restarts on current production build.

### Edge Cases
- Update detected while scanner/camera is active.
- Update detected during checkout submit.
- No network when tapping update.
- Multiple tabs/windows open.
- Cache reset invoked while offline.

## Acceptance Criteria
- [ ] App shows blocking update modal when SW reports new version.
- [ ] `Update now` activates latest version and reloads successfully.
- [ ] `Later` keeps app usable and does not loop modal in same session.
- [ ] Manual cache reset action is available and functional on iOS Safari/PWA.
- [ ] iOS test pass: Safari tab + home-screen installed app both move to new version without incognito workaround.
- [ ] Deployment docs include short operator runbook for update/cache issues.

## Implementation Plan
### Phase 1: Update Signal + Modal UX
- [ ] Add SW registration helper and update-available state in app shell.
- [ ] Build modal using existing shadcn dialog primitives.
- [ ] Wire modal actions (`Update now`, `Later`) with safe state handling.

### Phase 2: Manual Recovery Control
- [ ] Add "Reset app cache / force refresh" action in Settings/Debug area.
- [ ] Implement clear routine:
  - unregister service workers
  - clear Cache Storage keys
  - reload app
- [ ] Add guardrails + user message when cleanup fails.

### Phase 3: iOS Validation + Regression Tests
- [ ] Create manual iOS verification script (Safari + installed PWA).
- [ ] Add/extend browser test coverage for update prompt visibility and update action path.
- [ ] Confirm no regressions in lazy chunk retry behavior.

### Phase 4: Docs + Ops
- [ ] Update deployment troubleshooting with exact iOS recovery steps.
- [ ] Add short “how to verify latest build” QA checklist.

## Dependencies & Risks
- iOS service worker behavior can vary by version/device.
- Forcing immediate modal may interrupt active work unless gated by safe-state checks.
- Cache reset is destructive (clears offline artifacts); must be clearly labeled.

## Success Metrics
- No incognito workaround needed to validate latest build on iPad.
- Reduced stale-version support reports.
- Faster QA verification after deploy.

## References
- Brainstorm: `docs/brainstorms/2026-02-17-ios-pwa-update-reliability-brainstorm.md`
- `vite.config.ts:63`
- `vite.config.ts:112`
- `src/lib/lazyWithRetry.ts:15`
- `docs/solutions/build-errors/chunk-load-failed-PWA-20260201.md:27`
- `docs/specs/pwa_offline.md:83`
