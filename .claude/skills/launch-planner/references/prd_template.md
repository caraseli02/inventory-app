# MVP PRD Template

Use this template when generating PRDs for MVP ideas.

## Problem Statement

[One clear sentence defining what problem this solves]

## Target User

**Who**: [Specific persona - job title, situation, demographic]

**Current Behavior**: [What they do today without this product]

**Pain Point**: [Why their current solution isn't working]

## Success Metric

**Primary metric**: [The one number that tells you if this is working]

**Target**: [What value indicates success? e.g., "50 active users in first month"]

## Core User Flow

1. [User action 1]
2. [User action 2]
3. [User action 3]
4. [Value delivered]

**Time to value**: [How long until user gets benefit? e.g., "< 2 minutes"]

## MVP Features

### Must Have (Week 1)

| Feature | Why it's essential | Effort |
|---------|-------------------|--------|
| [Feature 1] | [Reason] | [1-3 days] |
| [Feature 2] | [Reason] | [1-3 days] |
| [Feature 3] | [Reason] | [1-3 days] |

**Total effort**: [Must be < 1 week]

### Explicitly Out of Scope

These features are intentionally excluded from MVP:

- [Feature] - Reason: [Why we're not building this yet]
- [Feature] - Reason: [Why we're not building this yet]
- [Feature] - Reason: [Why we're not building this yet]

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: [If needed, specify. Otherwise: "Deferred"]
- **Deployment**: Vercel
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui

## Data Model (Minimal)

[Only include tables/collections needed for core flow]

```
Table: [name]
- id
- [essential fields only]
- created_at
```

## Launch Checklist

Pre-launch:
- [ ] Core user flow works end-to-end
- [ ] Deployed to production URL
- [ ] Basic error handling in place
- [ ] Works on mobile (responsive)

Validation plan:
- [ ] Share with [N] target users
- [ ] Set up [success metric] tracking
- [ ] Schedule check-in [X days] after launch
- [ ] Define what "works" looks like (e.g., "3 users complete flow")

## Next Steps (Post-Validation)

*Only plan these after validating the MVP:*

1. [Feature to add if users want it]
2. [Feature to add if users want it]
3. [Improvement based on feedback]
