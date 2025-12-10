# UAT Quick Checklist
## User Acceptance Testing - Action Items

**Goal**: Get 1+ real user to use the app for 5+ products on 3+ days

---

## ☑️ PHASE 1: Pre-Launch (Day 0)

### Technical
- [ ] Run `pnpm build` - passes with no errors
- [ ] Run `pnpm tsc -b --noEmit` - no TypeScript errors
- [ ] Deploy to Vercel (if not already done)
- [ ] Set env vars in Vercel dashboard
- [ ] Test deployed app yourself - complete full cycle
- [ ] Test PWA install on real mobile device
- [ ] Verify camera works on iOS/Android

### Preparation
- [ ] Create Quick Start Guide (print-ready)
- [ ] Record 2-3 min demo video
- [ ] Set up feedback form (Google Forms/Typeform)
- [ ] Prepare WhatsApp/Telegram group for support

### User Recruitment
- [ ] Identify Tester 1: _____________________ (small store)
- [ ] Identify Tester 2: _____________________ (medium store)
- [ ] Identify Tester 3: _____________________ (optional)
- [ ] Confirm all have smartphones with camera
- [ ] Schedule 15-min kickoff calls

---

## ☑️ PHASE 2: Launch Day (Day 1)

### Morning
- [ ] Final deployment check
- [ ] Test all core features on production URL
- [ ] Verify Airtable connectivity

### Afternoon (Per Tester)
- [ ] Send deployment URL
- [ ] Guide PWA installation (Add to Home Screen)
- [ ] Test camera permissions together
- [ ] Demo: Scan → Adjust Stock
- [ ] Demo: Scan new → AI suggests → Create → Stock
- [ ] Share Quick Start Guide
- [ ] Share feedback form link
- [ ] Confirm contact method for issues

---

## ☑️ PHASE 3: Active Testing (Days 2-7)

### Daily Tasks
- [ ] Check Vercel logs for errors (morning)
- [ ] Monitor Airtable for new activity (evening)
- [ ] Respond to user messages within 2 hours
- [ ] Log any reported issues in UAT plan

### Day 4: Mid-Point Check-In
- [ ] Tester 1: How's it going? Any issues?
- [ ] Tester 2: How's it going? Any issues?
- [ ] Tester 3: How's it going? Any issues?

### Day 7: Final Debrief
- [ ] Schedule 15-min call with each tester
- [ ] Ask: Would you continue using this?
- [ ] Ask: What's the ONE thing you wish it did?
- [ ] Thank them for their time

---

## ☑️ PHASE 4: Analysis (Day 8)

### Success Check
- [ ] At least 1 user used app on 3+ different days?
- [ ] At least 1 user scanned 5+ products total?
- [ ] Zero critical bugs that block usage?
- [ ] At least 1 user wants to keep using it?

### If SUCCESS ✅
- [ ] Celebrate with testers! 🎉
- [ ] Prioritize top 3 feature requests
- [ ] Create GitHub issues for bugs
- [ ] Plan Week 3: Hardening (backend proxy, auth, security)

### If NOT YET ⏳
- [ ] Analyze why (technical vs. product-market fit)
- [ ] Document lessons learned
- [ ] Decide: Pivot / Iterate / Extend testing

### Always
- [ ] Update `claude-progress.md` with results
- [ ] Update `feature_list.json` if new bugs found
- [ ] Commit all learnings to git
- [ ] Send thank-you notes to testers

---

## 📞 Emergency Contacts

**Testers**:
- Tester 1: _____________________ (Phone: _____________)
- Tester 2: _____________________ (Phone: _____________)
- Tester 3: _____________________ (Phone: _____________)

**Resources**:
- Deployment URL: _____________________
- Feedback Form: _____________________
- Support Channel: _____________________

---

## 🚨 Critical Issues Protocol

If a tester reports:
1. **App crashes** → Fix within 1 hour, redeploy
2. **Can't scan at all** → Debug camera permissions, provide workaround
3. **Data loss** → Check Airtable, restore if possible, investigate cause
4. **Security concern** → Take app offline, fix immediately

---

## 📊 Success Metrics Dashboard

**Usage Tracking** (Check Airtable):
- Total products scanned: _____ / 15 target
- Total stock movements: _____ / 30 target
- Active days: _____ / 3 target
- Active users: _____ / 1 target

**Feedback Summary**:
- Net Promoter Score (1-10): _____
- Would continue using: _____ / 3 testers
- Top requested feature: _____________________
- Most common complaint: _____________________

---

**Status**: 🔴 NOT STARTED
**Start Date**: __________
**End Date**: __________
**Result**: PENDING
