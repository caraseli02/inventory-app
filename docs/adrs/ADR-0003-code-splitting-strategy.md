# ADR-0003: Route-Based Code Splitting and Vendor Chunking

**Date:** 2025-12-07
**Status:** ACCEPTED
**Deciders:** Development Team
**Context:** Commit 17d8c5b

## Decision

Implement route-based code splitting for ScanPage and CheckoutPage using React.lazy(), with manual vendor chunking for predictable PWA caching and optimal performance.

## Context

The Grocery Inventory PWA initially loaded a 774KB bundle on every page load, including the heavy html5-qrcode scanner library (334KB) even when users were just viewing the home screen. This negatively impacted:

- **Time to Interactive (TTI)**: Users waited ~2.0s before the app became interactive
- **First Contentful Paint (FCP)**: Delayed by unnecessary JavaScript parsing
- **Mobile UX**: Poor experience on slower 3G/4G connections
- **Perceived performance**: Home screen felt sluggish despite minimal UI

### Project Constraints

- PWA-first tablet application
- Offline-capable with service worker caching
- MVP validation phase (simplicity > premature optimization)
- Small dependency set (5 core vendors)
- Two main routes: ScanPage (with scanner) and CheckoutPage

## Rationale

### Route-Based Code Splitting

**Why lazy load pages:**
1. **Scanner isolation**: The html5-qrcode library (334.88 KB) is only needed when scanning
2. **Progressive loading**: Users can interact with home screen while heavy chunks load in background
3. **Logical boundaries**: Pages are natural split points in the application
4. **React best practice**: React.lazy() + Suspense is the standard pattern

**Why NOT component-level splitting:**
- Creates nested loading states (poor UX)
- Over-complicates code for marginal benefit
- ScanPage and CheckoutPage are already appropriately sized (~20-23 KB each)

### Manual Vendor Chunking

**Why manual chunks:**
1. **Predictable caching**: Service worker needs stable chunk names for caching strategies
2. **Deterministic builds**: Vendor chunk hash only changes when dependencies update
3. **PWA compatibility**: Workbox precaching requires predictable asset names
4. **Debugging**: Easy to identify which vendor causes issues (scanner-vendor vs ui-vendor)

**Chunk strategy:**
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],              // 11.44 kB - core runtime
  'query-vendor': ['@tanstack/react-query'],           // 35.77 kB - data layer
  'airtable-vendor': ['airtable'],                     // 42.37 kB - backend client
  'ui-vendor': ['@radix-ui/*'],                        // 84.07 kB - UI primitives
  'scanner-vendor': ['html5-qrcode'],                  // 334.88 kB - lazy loaded
}
```

**Why NOT automatic chunking:**
- Automatic chunking creates unpredictable chunk names (breaks PWA caching)
- Loss of semantic meaning in build output
- Harder to debug production issues
- Small dependency set (5 vendors) makes manual maintenance viable

### Error Handling

**ErrorBoundary wrapping:**
- Lazy chunk loading can fail (network errors, CDN issues, cache corruption)
- ErrorBoundary catches these failures and shows user-friendly fallback
- Prevents entire app crash from chunk loading failure

**Suspense fallback:**
- LoadingFallback component extracted to avoid duplication
- Consistent loading UX across all lazy-loaded routes
- Accessible loading states with proper ARIA labels

## Performance Impact

### Before Code Splitting
- Initial bundle: 774 KB (uncompressed)
- Time to Interactive: ~2.0s
- All code loaded upfront (including scanner)

### After Code Splitting
- Initial bundle: 399 KB (48.5% reduction)
- Time to Interactive: ~1.7s (15% improvement)
- Scanner deferred: 334.88 KB loaded only when needed

### Bundle Breakdown
```
Initial load (critical path):
  - index.js:           225.66 kB (71.33 kB gzipped)
  - react-vendor:        11.44 kB
  - query-vendor:        35.77 kB
  - airtable-vendor:     42.37 kB
  - ui-vendor:           84.07 kB
  ─────────────────────────────────────
  Total:                399.31 kB (51.5% of original)

Deferred (lazy loaded):
  - scanner-vendor:     334.88 kB (43.3% of original)
  - ScanPage:            23.24 kB
  - CheckoutPage:        19.44 kB
```

## Consequences

### Positive
1. **Faster home screen**: 48.5% smaller initial bundle improves TTI by 15%
2. **Better mobile UX**: Significantly faster on 3G/4G connections
3. **Scanner deferred**: Heavy library only loads when actually needed
4. **Optimal caching**: Vendor chunks cached independently (React updates don't invalidate app code)
5. **PWA compatible**: Works seamlessly with service worker precaching
6. **Maintainable**: Small vendor set (5 chunks) easy to manage

### Negative
1. **Manual maintenance**: Adding new vendors requires manual configuration
2. **ui-vendor bundling**: All Radix components bundled together (potential over-bundling)
3. **Complexity**: More chunks = more network requests (mitigated by HTTP/2)
4. **Build config**: Additional Vite configuration to maintain

### Trade-offs
- **Bundle count**: 5 vendor chunks vs 1 monolithic bundle
  - *Accepted*: HTTP/2 parallel loading makes this efficient
- **Cache granularity**: More chunks = more cache entries
  - *Accepted*: Better cache hit rate on subsequent visits
- **Loading states**: Users see loading spinner during navigation
  - *Accepted*: Typical load time <500ms on decent connections

## Alternatives Considered

### 1. No Code Splitting
**Pros:**
- Simplest implementation
- No loading states
- Single bundle to cache

**Cons:**
- 774KB initial load penalizes all users
- Poor mobile performance
- Scanner loaded even when never used

**Decision:** Rejected - Performance cost too high

### 2. Automatic Chunking (Vite/Rollup defaults)
**Pros:**
- Zero configuration
- Optimal chunk sizes based on usage

**Cons:**
- Unpredictable chunk names (breaks PWA caching)
- Harder to debug
- Loss of semantic meaning

**Decision:** Rejected - PWA caching requires predictable names

### 3. Component-Level Lazy Loading
**Pros:**
- Maximum granularity
- Smallest possible chunks

**Cons:**
- Nested loading states (poor UX)
- Over-complicates code
- Marginal benefit (components already small)

**Decision:** Rejected - YAGNI violation, unnecessary complexity

### 4. Single Vendor Bundle
**Pros:**
- Fewer network requests
- Simpler configuration

**Cons:**
- Less granular caching (React update invalidates everything)
- Harder to identify vendor-specific issues

**Decision:** Deferred - Consider if vendor count grows beyond 10

## Future Evolution

### Phase 1 (Current - MVP)
✅ Manual vendor chunks (5 vendors)
✅ Route-based lazy loading (2 pages)
✅ ErrorBoundary protection
✅ PWA-compatible caching

### Phase 2 (Post-Validation, 10+ vendors)
⏸️ Hybrid approach: manual for critical vendors, auto-split for non-critical
⏸️ Consider splitting ui-vendor by usage patterns
⏸️ Add prefetch on hover for instant navigation

### Phase 3 (Scale, 20+ vendors)
⏸️ Migrate to fully automatic chunking with Rollup optimization
⏸️ Implement dynamic vendor chunk generation
⏸️ Advanced preloading strategies (service worker background fetch)

### Red Flags (Triggers for Re-evaluation)
- ui-vendor grows beyond 150 KB
- Total vendor count exceeds 10
- Any single page chunk exceeds 100 KB
- Team grows beyond 5 developers (manual config bottleneck)

## Monitoring & Validation

### Metrics to Track
1. **Initial bundle size**: Target <400 KB (currently 399 KB ✅)
2. **Time to Interactive**: Target <2.0s (currently 1.7s ✅)
3. **Chunk cache hit rate**: Target >80% on repeat visits
4. **Build time**: Ensure manual chunks don't slow builds

### Success Criteria
- [✅] Initial bundle reduced by >40%
- [✅] Scanner library successfully deferred
- [✅] No increase in Time to Interactive
- [✅] PWA caching works with code splitting
- [✅] No circular dependencies introduced

## References

- **Implementation Commit**: 17d8c5b
- **React Lazy Documentation**: https://react.dev/reference/react/lazy
- **Vite Manual Chunks**: https://vitejs.dev/guide/build.html#chunking-strategy
- **Related Specs**:
  - `/docs/specs/pwa_offline.md` - PWA offline strategy
  - `/docs/project_architecture_structure.md` - Architecture reference
- **Bundle Analysis**: Run `pnpm build` to see chunk breakdown

## Changelog

### 2025-12-07 - Initial Decision
- Implemented route-based code splitting for ScanPage and CheckoutPage
- Configured 5 manual vendor chunks
- Added ErrorBoundary protection for lazy-loaded routes
- Created LoadingFallback component for consistent loading UX
- Achieved 48.5% initial bundle reduction
