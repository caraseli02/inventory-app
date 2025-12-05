# Claude Code Starter Prompt Templates

Use these templates when generating Claude Code prompts for users ready to build.

## Standard MVP Prompt Template

```
Build a [product name] - a [one-line description of what it does].

TARGET USER: [Specific persona]
PROBLEM: [One sentence problem statement]

CORE USER FLOW:
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Value delivered]

TECH STACK:
- Next.js 15 (App Router)
- Supabase for database
- Tailwind CSS for styling
- shadcn/ui for components
- Deploy to Vercel

MVP FEATURES (Priority order):
1. [Feature 1] - [Brief description]
2. [Feature 2] - [Brief description]
3. [Feature 3] - [Brief description]

DO NOT BUILD (explicitly out of scope):
- User authentication (use simple shared access for now)
- [Other deferred feature]
- [Other deferred feature]

PROJECT STRUCTURE:
```
app/
├── page.tsx          # Main landing/app page
├── layout.tsx        # Root layout
├── [feature]/        # Feature-specific pages
└── api/              # API routes if needed

components/
├── ui/               # shadcn components
└── [feature]/        # Feature components

lib/
├── supabase.ts       # Supabase client
└── utils.ts          # Helper functions
```

FIRST MILESTONE: 
Get [most basic version of core flow] working end-to-end. Should take < 1 day.

VALIDATION CRITERIA:
- [ ] A user can [complete core action]
- [ ] [Success metric] is being tracked
- [ ] Works on mobile
- [ ] Deployed to Vercel

Keep it simple. Focus on shipping something that works, not something perfect.
```

## Prompt for Data-Heavy Apps

```
Build a [product name] - [description].

CORE USER FLOW:
1. [User inputs/uploads data]
2. [System processes/displays data]
3. [User takes action based on insights]

TECH STACK:
- Next.js 15 (App Router) with Server Components
- Supabase (PostgreSQL + Realtime if needed)
- Tailwind CSS + shadcn/ui
- Vercel deployment

DATA MODEL (Supabase):
```sql
-- [table_name]
create table [table_name] (
  id uuid primary key default uuid_generate_v4(),
  [essential_field] text not null,
  created_at timestamptz default now()
);
```

MVP FEATURES:
1. [Data input method] - Let users add/upload data
2. [Core display] - Show the data in a useful way
3. [Key action] - Let users do the main thing

DO NOT BUILD YET:
- Complex filters or search
- Data export
- Multiple views/dashboards
- User accounts

FIRST MILESTONE:
Get one piece of data from user to database to display. Everything else builds on this.
```

## Prompt for Tool/Utility Apps

```
Build a [tool name] - [what it does in one sentence].

USER NEED: [Specific task user wants to accomplish]
CURRENT SOLUTION: [What they use today and why it's annoying]

CORE FLOW:
1. User [provides input]
2. Tool [processes it]
3. User [gets result]

TECH STACK:
- Next.js 15 (App Router)
- Client-side processing (no database needed for MVP)
- Tailwind CSS + shadcn/ui
- Vercel

MVP FEATURES:
1. [Input interface] - Simple form/upload
2. [Core processing] - The main algorithm/transformation
3. [Output display] - Show results clearly

DO NOT BUILD:
- User accounts or saving results
- History or previous conversions
- Batch processing
- Advanced options

FIRST MILESTONE:
One successful input → output flow. Make it work for one case before handling edge cases.

VALIDATION:
Can 5 people use it without instructions and get value?
```

## Key Principles for All Prompts

1. **Be explicit about what NOT to build** - Claude Code will often add features unless told not to
2. **Prioritize features** - List in order of importance
3. **Define first milestone** - Smallest possible working version
4. **Include validation criteria** - How to know if it's working
5. **Keep it under 1 week** - If the scope feels too big, cut features

## Common Additions to Avoid

Tell Claude Code NOT to add these unless explicitly requested:
- Loading states and skeletons (add after MVP works)
- Error boundaries and fallbacks (basic error handling is fine)
- Analytics and tracking (add after validation)
- SEO optimization (not relevant for MVP validation)
- Animations and transitions (ship first, polish later)
- Dark mode (nice-to-have, not MVP)
