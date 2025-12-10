# User Acceptance Testing Plan
## Grocery Inventory App - Real User Testing Guide

**Version**: 1.0.0
**Status**: READY FOR UAT
**Target Users**: Grocery store owners/workers
**Testing Duration**: 1 week minimum
**Created**: 2025-12-10

---

## 📋 Pre-Launch Readiness Checklist

### 1. Technical Validation
- [ ] **Production build passes** - Run `pnpm build` (no errors)
- [ ] **TypeScript compilation clean** - Run `pnpm tsc -b --noEmit`
- [ ] **App deployed to Vercel** - Live URL available
- [ ] **Environment variables set** in Vercel dashboard:
  - [ ] `VITE_AIRTABLE_API_KEY`
  - [ ] `VITE_AIRTABLE_BASE_ID`
- [ ] **Test deployed app yourself** - Complete one full scan-to-stock cycle
- [ ] **Verify PWA works** - Test on actual mobile device
- [ ] **Camera permissions work** - Test on both iOS and Android if possible

### 2. Test Environment Setup
- [ ] **Create test Airtable base** (optional but recommended)
  - Clone current base to avoid polluting production data
  - Use test base for UAT period
- [ ] **Document rollback plan** in case of critical issues
- [ ] **Set up monitoring** - Check Vercel logs daily
- [ ] **Prepare support channel** - WhatsApp/Slack/Email for user questions

### 3. User Recruitment & Preparation
- [ ] **Identify 2-3 beta testers** (grocery owners/workers)
  - At least 1 small grocery store
  - At least 1 medium-sized operation
  - Ideally different geographic locations
- [ ] **Confirm device compatibility**:
  - [ ] Testers have smartphones (iOS or Android)
  - [ ] Testers can access camera permissions
  - [ ] Testers comfortable with basic apps
- [ ] **Schedule kickoff calls** with each tester (15 min each)

### 4. Documentation & Materials
- [ ] **Create Quick Start Guide** (1-page, print-friendly)
- [ ] **Record demo video** (2-3 minutes showing the 4 core actions)
- [ ] **Prepare FAQ sheet** with common issues
- [ ] **Create feedback form** (Google Forms or Typeform)

---

## 🚀 Launch Sequence (Day 1)

### Morning: Final Checks
1. [ ] Deploy latest version to Vercel
2. [ ] Test all core features on deployed URL
3. [ ] Verify Airtable connection working
4. [ ] Check PWA installation on your device

### Afternoon: User Onboarding (Per Tester)
**Kickoff Call Script** (15 minutes):

1. **Introduction (2 min)**
   - "Thank you for helping test our grocery inventory app"
   - "It helps you track stock by scanning barcodes"
   - "We need your honest feedback - nothing is too small to mention"

2. **Share Access (3 min)**
   - Send deployment URL via SMS/WhatsApp
   - Guide them to open in browser
   - Help install as PWA (Add to Home Screen)
   - Test camera permissions together

3. **Demo Core Loop (5 min)**
   - Show: Scan → View → Adjust Stock
   - Show: Scan new product → AI suggests details → Create → Add Stock
   - Emphasize: "It's this simple - scan, adjust, done"

4. **Set Expectations (3 min)**
   - "Use it whenever you receive stock or sell items"
   - "Try to scan at least 5 products in the first 3 days"
   - "We'll check in after 3 days, then again after 7 days"
   - Share feedback form link

5. **Answer Questions (2 min)**
   - Address immediate concerns
   - Confirm contact method for issues

---

## 📱 User Testing Scenarios

### Scenario 1: First-Time Scan (Existing Product)
**Goal**: Test basic scanning and stock adjustment
**Steps**:
1. Open the app
2. Tap "Start Scanning" or similar
3. Allow camera permissions (if prompted)
4. Scan a product barcode
5. View product details
6. Add stock IN (e.g., +10 units received)
7. Verify stock count updates

**Success Criteria**:
- ✅ Camera opens successfully
- ✅ Barcode scans correctly
- ✅ Product details display
- ✅ Stock adjustment completes without errors
- ✅ User understands what happened

---

### Scenario 2: Create New Product with AI
**Goal**: Test new product creation with auto-fill
**Steps**:
1. Scan a barcode not in database
2. See "Product not found" message
3. Tap "Create New Product"
4. Wait for AI auto-fill (if product is in OpenFoodFacts)
5. Review suggested name, category, image
6. Adjust price if needed
7. Save product
8. Add initial stock

**Success Criteria**:
- ✅ AI suggests accurate product details
- ✅ User can edit suggestions
- ✅ Product creation completes
- ✅ User feels confident about the process

---

### Scenario 3: Daily Stock-Out (Checkout)
**Goal**: Test removing stock when products are sold
**Steps**:
1. Scan a product
2. Tap "Remove Stock" or OUT action
3. Enter quantity sold (e.g., -3 units)
4. Confirm action
5. Verify stock count decreases

**Success Criteria**:
- ✅ OUT action is intuitive
- ✅ Stock decreases correctly
- ✅ No confusion about negative numbers
- ✅ Process is fast enough for checkout flow

---

### Scenario 4: Large Delivery (Bulk Stock IN)
**Goal**: Test receiving a large shipment
**Steps**:
1. Scan first product
2. Add stock IN (e.g., +50 units)
3. See large quantity confirmation dialog (for 50+ items)
4. Confirm action
5. Repeat for 5+ products in shipment

**Success Criteria**:
- ✅ Confirmation dialog prevents accidental large entries
- ✅ Process is fast enough for receiving workflow
- ✅ No performance issues with repeated scans
- ✅ User feels confident in accuracy

---

### Scenario 5: View Stock History
**Goal**: Test viewing past stock movements
**Steps**:
1. Scan a product
2. View product details
3. Scroll to "Recent Activity" or similar section
4. Review last 10 stock movements
5. Verify dates and quantities make sense

**Success Criteria**:
- ✅ History displays correctly
- ✅ IN/OUT movements are clear
- ✅ Dates are readable
- ✅ User trusts the audit trail

---

### Scenario 6: Error Recovery (Network Failure)
**Goal**: Test app behavior when network drops
**Steps**:
1. Turn on Airplane Mode (simulate network loss)
2. Try to scan a product
3. See error message
4. Turn off Airplane Mode
5. Retry scan

**Success Criteria**:
- ✅ Error message is clear and helpful
- ✅ App doesn't crash
- ✅ User knows how to recover
- ✅ Retry works after network restored

---

## 📊 Data Collection & Monitoring

### Daily Checks (Your Responsibility)
- [ ] **Check Vercel logs** for errors
- [ ] **Monitor Airtable** - Look for new products/movements
- [ ] **Respond to user messages** within 2 hours during business hours
- [ ] **Log issues** in `USER_ACCEPTANCE_TESTING_PLAN.md` → Issues Tracker section

### User Feedback Collection

**After 3 Days - Mid-Point Check-In**
Send message/call each tester:

Questions to ask:
1. How many times have you used the app?
2. What worked well?
3. What was confusing or frustrating?
4. Did you encounter any errors?
5. Would you continue using this?
6. What's the ONE thing you wish it did?

**After 7 Days - Final Debrief**
Schedule 15-min call with each tester:

Questions to ask:
1. Did the app save you time vs. your old method?
2. Would you recommend it to other grocery owners?
3. What would make you use it every day?
4. Any features you expected but didn't find?
5. On a scale of 1-10, how likely are you to keep using it?

---

## ✅ Success Criteria

### Minimum Viable Success (Week 1)
- ✅ **At least 1 user** scans **5+ products** on **3+ different days**
- ✅ **Zero critical bugs** that block core functionality
- ✅ **At least 1 user** says they would continue using it

**Decision Tree**:
- **If success criteria met** → Proceed to hardening (backend proxy, security, observability)
- **If not met** → Analyze why, pivot, or sunset project (don't invest in infrastructure)

### Stretch Goals (Nice to Have)
- 🎯 All 3 testers use app daily
- 🎯 At least 1 tester requests a feature
- 🎯 At least 50 total stock movements recorded
- 🎯 Zero app crashes reported

---

## 🐛 Issues Tracker

### How to Log Issues
When a user reports a problem:
1. Add entry below with date, user ID (U1, U2, U3), and description
2. Categorize as CRITICAL / HIGH / MEDIUM / LOW
3. Track resolution in `claude-progress.md` → Known Issues

### Template
```
- [PRIORITY] Description (Reported: YYYY-MM-DD by U#)
  - Impact: [How it affects usage]
  - Workaround: [Temporary fix if any]
  - Status: OPEN / IN PROGRESS / FIXED
```

### Issues Log
*No issues reported yet - testing not started*

---

## 📝 Quick Start Guide for Users

**PRINT THIS AND GIVE TO TESTERS:**

---

### 📱 Grocery Inventory App - Quick Start

#### Setup (One Time)
1. Open this link on your phone: `[YOUR_VERCEL_URL]`
2. Tap **Share** → **Add to Home Screen**
3. Allow camera permissions when asked

#### Daily Use

**Receiving Stock (Delivery Arrived)**
1. Open app
2. Scan product barcode
3. Tap **Add Stock**
4. Enter quantity received (e.g., 10)
5. Done! ✅

**Selling Product (Checkout)**
1. Scan product barcode
2. Tap **Remove Stock**
3. Enter quantity sold (e.g., 3)
4. Done! ✅

**New Product (First Time)**
1. Scan barcode
2. If not found, tap **Create New**
3. App suggests name/category/image
4. Adjust price
5. Save
6. Add initial stock

#### Need Help?
Contact: `[YOUR_PHONE/EMAIL]`

---

## 📞 Support Protocol

### Response Times
- **Critical issues** (app crashes, can't scan): Respond within 1 hour
- **High priority** (features not working): Respond within 4 hours
- **General questions**: Respond within 24 hours

### Common Issues & Solutions

**Issue**: Camera won't open
**Solution**: Settings → Safari/Chrome → Camera → Allow

**Issue**: Barcode won't scan
**Solution**: Clean camera lens, try better lighting, hold steady

**Issue**: "Network error" message
**Solution**: Check WiFi/data connection, retry in 30 seconds

**Issue**: Stock count seems wrong
**Solution**: Check Recent Activity → Verify all movements are correct

---

## 🎯 Post-UAT Actions

### If Testing Succeeds
1. [ ] Schedule debrief with all testers (celebrate! 🎉)
2. [ ] Prioritize top 3 requested features
3. [ ] Update `claude-progress.md` with findings
4. [ ] Create GitHub issues for bugs found
5. [ ] Begin Week 3 work (hardening):
   - Backend proxy for Airtable
   - Proper authentication
   - Enhanced error tracking
   - Input sanitization

### If Testing Fails
1. [ ] Analyze root causes (technical vs. product-market fit)
2. [ ] Document lessons learned
3. [ ] Decide: Pivot vs. Iterate vs. Sunset
4. [ ] Thank testers for their time

### Either Way
1. [ ] Update `feature_list.json` with any new issues found
2. [ ] Commit all learnings to git
3. [ ] Send thank-you notes to testers

---

## 📚 Reference Materials

### For You (Developer)
- `claude-progress.md` - Track bugs and progress
- `feature_list.json` - Mark features as tested
- `docs/specs/mvp_scope_lean.md` - MVP scope reference
- `docs/TROUBLESHOOTING.md` - Production issue solutions
- `docs/DEPLOYMENT.md` - Deployment procedures

### For Users
- Quick Start Guide (above)
- Demo video (record this before UAT)
- Feedback form (create Google Form)

---

## 🔄 Testing Timeline

**Day 0 (Today)**: Complete Pre-Launch Checklist
**Day 1**: Onboard all testers
**Day 2-3**: Monitor usage, respond to issues
**Day 4**: Mid-point check-in calls
**Day 5-6**: Continue monitoring
**Day 7**: Final debrief calls
**Day 8**: Analyze results, decide next steps

---

**Status**: 🟡 READY TO START
**Last Updated**: 2025-12-10
**Owner**: TBD
