# Deployment Guide

Complete guide for deploying the Grocery Inventory App to production.

## Prerequisites

- Vercel account (or other hosting platform)
- Airtable account with configured base
- Node.js 18+ and pnpm installed locally

---

## Environment Variables

### Required Variables

Set these in your hosting platform (Vercel, Netlify, etc.):

```bash
VITE_AIRTABLE_API_KEY=your_personal_access_token_here
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

### Getting Your Airtable Credentials

1. **API Key (Personal Access Token):**
   - Go to https://airtable.com/create/tokens
   - Click "Create new token"
   - Name: "Inventory App Production"
   - Add scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
   - Add access to your base
   - Copy the token (starts with `pat...`)

2. **Base ID:**
   - Open your Airtable base
   - Click "Help" → "API documentation"
   - Base ID is shown at the top (starts with `app...`)

---

## Vercel Deployment

### Initial Setup

1. **Install Vercel CLI (optional):**
   ```bash
   npm i -g vercel
   ```

2. **Connect Repository:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the repository

3. **Configure Project:**
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `pnpm run build`
   - Output Directory: `dist`

4. **Add Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add `VITE_AIRTABLE_API_KEY`
   - Add `VITE_AIRTABLE_BASE_ID`
   - Scope: Production, Preview, Development

5. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete

### Continuous Deployment

After initial setup, every push to `main` triggers automatic deployment:

```bash
git push origin main
```

### Manual Deployment

Using Vercel CLI:

```bash
# Production
vercel --prod

# Preview
vercel
```

---

## Build Verification

Before deploying, always verify the build locally:

```bash
# Install dependencies
pnpm install

# Run TypeScript check
pnpm run build

# Preview production build
pnpm run preview
```

Expected output:
```
✓ 1875 modules transformed.
✓ built in ~2s
```

If you see errors, fix them before deploying.

---

## Post-Deployment Checklist

After deploying, verify:

### 1. App Loads
- [ ] Navigate to your production URL
- [ ] App loads without black screen
- [ ] No JavaScript errors in console

### 2. CSP Headers Working
- [ ] Open browser DevTools → Console
- [ ] Check for CSP violation errors
- [ ] Should see NO errors like "Refused to connect..."

### 3. Scanner Functionality
- [ ] Click "Add Items"
- [ ] Camera permission prompt appears
- [ ] Scanner starts successfully
- [ ] Scan a barcode → Item adds once (no loop)
- [ ] Modal opens → Scanner stops

### 4. Checkout Flow
- [ ] Click "Checkout Mode"
- [ ] Scanner active
- [ ] Scan product → Adds to cart
- [ ] Cart auto-collapses
- [ ] Expand cart → Scanner stops
- [ ] Click "Finish" → Dialog appears with white background
- [ ] Confirm → Items processed successfully

### 5. API Calls
- [ ] Open DevTools → Network tab
- [ ] Scan a product
- [ ] Should see successful request to `api.airtable.com`
- [ ] No blocked or failed requests

### 6. PWA Installation
- [ ] On mobile, visit site
- [ ] Browser shows "Add to Home Screen" prompt
- [ ] Install app
- [ ] App opens in standalone mode
- [ ] Works as expected

---

## Troubleshooting Deployment Issues

### Black Screen After Deployment

**Symptoms:** App loads but shows black screen, console shows CSP errors.

**Fix:** Verify `vercel.json` CSP headers include all required domains.

**See:** [TROUBLESHOOTING.md - Black Screens](./TROUBLESHOOTING.md#black-screens--failed-api-calls)

### ChunkLoadError

**Symptoms:** Console shows "Loading chunk X failed"

**Fix:** Clear browser cache and service worker, reload page.

**See:** [TROUBLESHOOTING.md - PWA Issues](./TROUBLESHOOTING.md#pwa--service-worker-issues)

### Scanner Not Working

**Symptoms:** Camera doesn't start, black rectangle shown.

**Fix:** Check HTTPS (required for camera), verify browser permissions.

**See:** [TROUBLESHOOTING.md - Scanner Issues](./TROUBLESHOOTING.md#scanner-issues)

---

## Rollback Procedure

If deployment breaks production:

### Option 1: Vercel Dashboard
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments"
4. Find last working deployment
5. Click "..." → "Promote to Production"

### Option 2: Git Revert
```bash
# Find the bad commit
git log --oneline -10

# Revert it
git revert <bad-commit-hash>

# Push
git push origin main
```

### Option 3: Redeploy Previous Commit
```bash
# Checkout previous commit
git checkout <good-commit-hash>

# Force deploy
vercel --prod --force

# Return to main
git checkout main
```

---

## Monitoring

### Key Metrics to Monitor

1. **Error Rate:**
   - Use Vercel Analytics or Sentry
   - Alert on spike in errors

2. **API Response Times:**
   - Monitor Airtable API latency
   - Alert if > 2 seconds

3. **Service Worker Updates:**
   - Check deployment logs
   - Verify new SW activates

### Recommended Tools

- **Vercel Analytics:** Built-in, free
- **Sentry:** Error tracking (optional)
- **Vercel Logs:** Real-time debugging

---

## Security Considerations

### CSP Headers

The app uses strict Content Security Policy headers defined in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://api.airtable.com https://*.airtable.com https://world.openfoodfacts.org https://images.openfoodfacts.org; frame-ancestors 'none'; media-src 'self' blob:;"
        }
      ]
    }
  ]
}
```

**Important:**
- `'unsafe-eval'` is required for Vite/React runtime
- `'unsafe-inline'` is required for styled components
- `blob:` is required for scanner camera stream
- DO NOT remove required domains from `connect-src`

### Airtable Security

- ✅ Use Personal Access Tokens (not deprecated API keys)
- ✅ Limit token scopes to only required permissions
- ✅ Rotate tokens regularly (every 90 days)
- ✅ Never commit tokens to git
- ✅ Use environment variables

### HTTPS

- ✅ Always deploy with HTTPS (Vercel provides this automatically)
- ✅ Required for camera access (getUserMedia API)
- ✅ Required for service worker registration

---

## Performance Optimization

### Code Splitting

The app uses route-based code splitting:

```typescript
// Lazy loaded pages
const ScanPage = lazy(() => import('./pages/ScanPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
```

**Manual chunks (vite.config.ts):**
- `react-vendor` - React core (~11KB)
- `query-vendor` - React Query (~36KB)
- `airtable-vendor` - Airtable SDK (~42KB)
- `ui-vendor` - Radix UI components (~84KB)
- `scanner-vendor` - html5-qrcode (~335KB)

### PWA Caching

Service worker caches:
- **App shell:** Precached on install
- **Google Fonts:** Cache-first (365 days)
- **OpenFoodFacts API:** Stale-while-revalidate (24 hours)
- **Product images:** Cache-first (30 days)

### Performance Budgets

Target metrics:
- First Contentful Paint (FCP): < 1.5s
- Time to Interactive (TTI): < 3.5s
- Total Bundle Size: < 850KB (achieved: ~813KB)

---

## Scaling Considerations

### Airtable Limits

Free tier limits:
- 1,200 records per base
- 5 API requests per second
- 1 GB attachment storage

If you hit these limits:
- Upgrade to paid Airtable plan
- Implement request queuing/throttling
- Consider migrating to dedicated database (see `docs/specs/backend_proxy.md`)

### Expected Load

Current architecture supports:
- ~10 concurrent users
- ~50 scans per minute
- ~500 products in inventory

For higher load, consider:
- Implementing backend proxy (see `docs/specs/backend_proxy.md`)
- Adding Redis cache layer
- Using serverless functions for Airtable calls

---

## Backup & Recovery

### Data Backup

Airtable provides:
- Automatic backups (paid plans)
- Manual CSV exports
- Snapshot history (14-30 days)

**Recommended:**
1. Set up weekly CSV exports
2. Store in separate cloud storage (Google Drive, S3)
3. Test restore procedure quarterly

### Code Backup

Git is your backup:
```bash
# All production code is in git
git log --oneline -10

# Tag releases
git tag v1.0.0
git push --tags
```

---

## Support & Maintenance

### Regular Maintenance

**Weekly:**
- [ ] Check Vercel deployment logs
- [ ] Review error tracking (if configured)
- [ ] Monitor Airtable usage

**Monthly:**
- [ ] Update dependencies: `pnpm update`
- [ ] Review CSP violations (if any)
- [ ] Test full user flow in production

**Quarterly:**
- [ ] Rotate Airtable tokens
- [ ] Review and optimize bundle size
- [ ] Update documentation

---

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [PWA Documentation](https://web.dev/progressive-web-apps/)

---

**Last Updated:** 2025-12-07
**Version:** 1.0.0
