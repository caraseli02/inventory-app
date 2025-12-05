# Common Product Decisions

Quick reference for common questions that come up during MVP builds.

## Authentication & User Management

### "Should I add user authentication?"

**Default answer: NO** (for MVP)

**When to defer auth:**
- You're validating if people want the product
- You have < 100 users
- The product works without knowing who the user is
- Users don't need to save data between sessions

**Simple alternatives:**
- Single shared password for access
- localStorage for saving user's own data
- Magic link (email) without password
- Unique URL per user (like Calendly)

**When auth IS needed for MVP:**
- User data is sensitive (financial, health, personal)
- Multi-user collaboration is the core value prop
- Personalization is essential to the product working

**If you must add auth:**
- Use Supabase Auth (already in tech stack)
- Email + password only (no social login)
- Skip password reset flow initially
- No email verification for MVP

## Database & Data Storage

### "How should I structure my database?"

**MVP principle:** Start with the simplest schema that works

**Common pattern:**
```sql
-- Start with flat tables
create table items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,  -- even without auth, useful for tracking
  name text,
  data jsonb,  -- dump everything else here
  created_at timestamptz default now()
);
```

**Defer these optimizations:**
- Normalized tables with foreign keys
- Indexes (add after you have performance issues)
- Triggers and stored procedures
- Row-level security (unless sensitive data)

### "Should I use a real-time database?"

**Default answer: NO**

Use real-time only if:
- Collaboration is the core feature (multiple users editing simultaneously)
- Live updates are essential to the user experience (chat, notifications)

Otherwise, simple polling or manual refresh is fine for MVP.

## Features & Functionality

### "Should I add search/filters?"

**Default answer: Start with basic sort/filter**

**MVP version:**
- Simple dropdown filters
- Basic text matching
- Sort by date or name

**Defer:**
- Full-text search
- Advanced filters with AND/OR logic
- Search suggestions
- Fuzzy matching

### "Should I add email notifications?"

**Default answer: NO** (for MVP)

**Alternatives:**
- In-app notifications only
- Manual "refresh" to see updates
- Daily digest instead of instant notifications

**When to add:**
- After users explicitly ask for it
- When you've validated core product value

### "Should users be able to export data?"

**Default answer: NO** (for MVP)

Add after users request it. Most users won't export data from an MVP they're just testing.

### "Should I make it mobile responsive?"

**Default answer: YES** (basic responsiveness)

Use Tailwind's responsive classes. Don't build a separate mobile app.

**MVP standard:**
- Works on phone (readable, usable)
- Doesn't need to be perfect
- Defer: mobile-specific features, native apps, PWA

## UI/UX Decisions

### "How polished should the UI be?"

**MVP standard:**
- Clean and professional (not amateur)
- Consistent spacing and typography
- No broken layouts or obvious bugs
- Works on mobile

**Defer:**
- Custom illustrations
- Animations and transitions
- Loading skeletons
- Empty states
- Dark mode

### "Should I add onboarding/tutorial?"

**Default answer: NO**

**MVP approach:**
- The product should be obvious enough without a tutorial
- Add tooltips if absolutely necessary
- Write one sentence of explanation, not a full guide

**When to add:**
- After users are confused (they'll tell you)
- After you've validated they want to use it

### "Should I have a landing page separate from the app?"

**Default answer: NO**

**MVP approach:**
- App page can be the landing page
- Add one paragraph explaining what it does
- Skip: marketing site, feature pages, pricing pages

## Performance & Scale

### "Should I optimize for performance?"

**Default answer: NO** (beyond basics)

**MVP standard:**
- Fast enough that users don't complain
- No 10-second load times
- Basic image optimization (use Next.js Image)

**Defer:**
- Database query optimization
- Caching layers
- CDN beyond Vercel's default
- Code splitting beyond Next.js defaults

### "Should I handle edge cases?"

**Default answer: NO** (for MVP)

**Handle:**
- Happy path (when everything works)
- Basic error messages (try/catch with user-friendly message)

**Defer:**
- Every possible error state
- Validation for all inputs
- Handling offline mode
- Handling slow connections

## Technical Decisions

### "Should I write tests?"

**Default answer: NO** (for MVP)

**MVP approach:**
- Manual testing of core flow
- Fix bugs as users report them

**When to add:**
- After validating the product
- When refactoring working features
- For complex business logic

### "Should I set up monitoring/analytics?"

**Default answer: MINIMAL**

**Include:**
- Basic error logging (console.error is fine)
- Track your success metric (manually if needed)

**Defer:**
- Detailed analytics
- User behavior tracking
- Performance monitoring
- Custom dashboards

### "Should I add a admin dashboard?"

**Default answer: NO**

**MVP approach:**
- Use Supabase dashboard to view data
- Use SQL queries for insights
- Manually handle edge cases

**When to add:**
- After you have enough users that manual work is painful
- After validating the core product

## General Decision Framework

When unsure about adding something, ask:

1. **Is it required for the core user flow?** NO → Defer it
2. **Can I validate the idea without it?** YES → Defer it
3. **Will users explicitly ask for it?** MAYBE → Defer it and see
4. **Does it take more than 1 day to build?** YES → Find simpler version or defer

**Remember:** You can always add features after validation. You cannot get back time spent on features nobody wanted.
