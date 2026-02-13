---
date: 2026-02-12
topic: refresh-safe-navigation
---

# Refresh-Safe Navigation (Mode Selection, Checkout, Inventory List)

## What We're Building
Today the app uses an in-memory view switch in `src/App.tsx` (`useState<ViewState>('home')`). When the user refreshes on Checkout or Inventory List, the SPA is reloaded and that state resets to `'home'`, which feels like being “kicked out” to mode selection.

We want navigation that is stable across page refresh and supports browser expectations (refresh, back/forward, deep link), so:
- Refresh on Checkout stays on Checkout.
- Refresh on Inventory List stays on Inventory List.
- The user doesn’t need to re-select a mode after refresh.

## Why This Approach
There are three reasonable options, ordered from most “web-native” to most “minimal change”.

### Approach A (Recommended): URL-Based Routing
Define real routes like `/`, `/checkout`, `/inventory`, `/manage`.

Pros:
- Fixes refresh/back/forward naturally.
- Enables deep links and shareable URLs.
- Removes a class of “state got lost” bugs.

Cons:
- Requires introducing a router and touching navigation patterns.

Best when: you want the app to behave like a normal web app and keep scaling without navigation pain.

### Approach B: Persist View in Storage
Keep the single-page `view` state but mirror it into `localStorage` (or similar) and hydrate on load.

Pros:
- Smallest code change.

Cons:
- URL still doesn’t reflect location (no deep links, awkward back button).
- Risk of stale/incorrect state (e.g., opening multiple tabs).

Best when: you only care about refresh staying in the same mode, not web-native navigation.

### Approach C: Server/User Preference Default
Persist “last mode” (or default mode) per user (e.g., profile) and auto-redirect from `/`.

Pros:
- Works across devices.

Cons:
- Still benefits from routes; otherwise you’re just masking the symptom.

Best when: you want a personalized landing experience.

## Key Decisions
- Use URL-based routing (Approach A) so refresh/back/forward and deep links work.
- Refreshing on Checkout must restore the cart (not just keep the user on the page).
- Landing route `/` always shows mode selection.

## Open Questions
- What should landing route `/` do?
  - Option 1: Always show mode selection.
  - Option 2: Auto-redirect to last-used mode.
  - Option 3: Go to a fixed default (e.g., Inventory List).

## Answered
- Refreshing on Checkout must restore the cart.

## Next Steps
→ `/workflows:plan` to pick an approach and define acceptance criteria + rollout plan.
