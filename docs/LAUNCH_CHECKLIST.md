# 🚀 Launch Checklist - Ship by Friday 2025-12-06

This is your actionable checklist to deploy your grocery inventory app this week.

## Prerequisites (5 minutes)

- [ ] You have an Airtable account with the inventory base set up
- [ ] You have a Vercel account (free tier is fine)
- [ ] You have 2-3 people who will test the app next week

## Step 1: Pre-Launch Verification (10 minutes)

### Test Locally
- [ ] Run `pnpm dev`
- [ ] Scan a real barcode (or use a test barcode like "5449000000996" - Coca-Cola)
- [ ] Create a new product
- [ ] Add stock IN
- [ ] Remove stock OUT
- [ ] Verify everything works end-to-end

### Check Environment
- [ ] Verify `.env` file exists and has valid Airtable credentials
- [ ] Verify `.env` is in `.gitignore` (should already be)
- [ ] Run `pnpm build` to confirm production build works

**If any test fails, stop and fix before deploying.**

## Step 2: Deploy to Vercel (10 minutes)

### Initial Setup
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel` in project root
- [ ] Follow prompts (accept defaults)
- [ ] When asked "Link to existing project?" → No (first time) or Yes (if redeploying)

### Set Environment Variables
- [ ] Go to Vercel dashboard → Your Project → Settings → Environment Variables
- [ ] Add `VITE_AIRTABLE_API_KEY` with your Airtable token
- [ ] Add `VITE_AIRTABLE_BASE_ID` with your base ID
- [ ] Click "Save"

### Redeploy with Env Vars
- [ ] Run `vercel --prod` to deploy with environment variables
- [ ] Wait for deployment to complete (~1 minute)
- [ ] Copy the production URL (something like `https://inventory-app-xyz.vercel.app`)

## Step 3: Test Deployment (5 minutes)

### Smoke Test
- [ ] Open the deployed URL on your phone
- [ ] Grant camera permissions
- [ ] Scan a real barcode
- [ ] Verify product lookup works
- [ ] Create a new product
- [ ] Verify stock IN/OUT works

**If any test fails:**
- Check Vercel logs: `vercel logs`
- Verify env vars are set correctly in Vercel dashboard
- Verify app works locally with same env vars

## Step 4: Secure the Deployment (5 minutes)

### Option A: Password Protection (Recommended for MVP)
- [ ] Go to Vercel dashboard → Your Project → Settings → Deployment Protection
- [ ] Enable "Password Protection"
- [ ] Set a password (share only with testers)

### Option B: Vercel Authentication (If you prefer)
- [ ] Enable "Vercel Authentication" instead
- [ ] Invite testers via email

### Option C: Keep Public (Risky but simplest)
- [ ] Accept that the URL is public but hard to guess
- [ ] Don't share URL widely
- [ ] Monitor Airtable usage for unexpected activity

## Step 5: Share with Testers (10 minutes)

### Prepare Instructions for Testers
Create a simple message:

```
Hey! I built a grocery inventory app and would love your feedback.

What it does: Scan product barcodes to quickly add/remove items from inventory.

How to test:
1. Open this URL on your tablet/phone: [YOUR_VERCEL_URL]
2. Grant camera permissions when prompted
3. Point camera at any grocery barcode
4. Try adding/removing stock

I need you to actually use this for real inventory tracking for the next week if possible.

Password (if protected): [PASSWORD]

Let me know what breaks or what's confusing!
```

### Send to Testers
- [ ] Text/email the URL to 2-3 people
- [ ] Ask them to try it within 24 hours
- [ ] Set expectation: "This is rough, I want honest feedback"

## Step 6: Set Validation Checkpoints (2 minutes)

- [ ] Calendar reminder for Monday 2025-12-09: "Check who used the app over weekend"
- [ ] Calendar reminder for Thursday 2025-12-12: "Evaluate week 1 usage - did anyone use it 3+ days?"

## Step 7: Update Documentation (10 minutes)

### Update README.md
- [ ] Add deployed URL at top
- [ ] Simplify setup instructions (remove extra details)
- [ ] Add "Quick Start" section
- [ ] Remove references to unimplemented features

### Update docs/README.md
- [ ] Update status of `mvp_scope_lean.md` to ACTIVE
- [ ] Mark old `mvp_scope.md` as SUPERSEDED
- [ ] Add link to `LAUNCH_CHECKLIST.md`

## Success Criteria

You've successfully launched when:

- ✅ App is deployed and accessible via public URL
- ✅ You've tested core flow end-to-end on deployed version
- ✅ At least 2 people have the link and know to test it
- ✅ You have calendar reminders to check back in 1 week

## Common Issues & Solutions

### "Environment variables not working in production"
**Solution:** Vercel requires redeployment after adding env vars. Run `vercel --prod` again.

### "Camera doesn't work on deployed site"
**Solution:** HTTPS is required for camera access. Vercel provides this automatically, but some browsers need explicit permission. Try in Chrome on mobile.

### "Airtable API returns 401 Unauthorized"
**Solution:**
- Check env vars in Vercel dashboard are exactly correct
- Verify Airtable token has read/write permissions
- Check token hasn't expired

### "Build fails on Vercel"
**Solution:**
- Check build logs in Vercel dashboard
- Ensure `pnpm build` works locally first
- TypeScript errors will fail the build - fix them first

### "Barcode scanner shows black screen"
**Solution:**
- User needs to grant camera permissions
- Some phones require HTTPS (Vercel has this)
- Try different browser (Chrome works best)

## What NOT to Do

- ❌ Don't spend time perfecting the UI
- ❌ Don't add features before getting user feedback
- ❌ Don't build the backend proxy yet
- ❌ Don't worry about scaling/performance
- ❌ Don't wait for "perfect" - ship now, improve later

## After Launch

### Week 1 Focus
1. Monitor if people actually use it
2. Note what confuses users
3. Fix critical bugs only
4. Resist adding new features

### Week 1 Success = Any of These
- Someone uses it 3+ days in a row
- Someone asks "can you add [feature]?" (they care!)
- Someone says they'd be sad if it went away

### Week 1 Failure = All of These
- Nobody uses it more than once
- Nobody asks questions or gives feedback
- You're the only one scanning barcodes

If success → Move to phase 2 (hardening)
If failure → Figure out why before building more

## Need Help?

### Vercel Deployment Issues
- Docs: https://vercel.com/docs
- Check logs: `vercel logs --follow`

### Airtable API Issues
- Verify token: Go to Airtable → Account → Developer hub → Personal access tokens
- Check permissions: Token needs "data.records:read" and "data.records:write"

### App Not Working
- Check browser console for errors (F12)
- Verify env vars match between local and production
- Test locally first to isolate deployment issues

---

**Remember:** Launching isn't about perfection. It's about getting real feedback. Ship it messy. Improve it later.

**Set your timer. Launch by Friday. No excuses.**
