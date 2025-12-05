# Roadmap Builder Skill

## Purpose
Help product builders make disciplined decisions about what to build next using a ruthless prioritization framework that prevents feature creep and keeps focus on what actually moves the needle.

## When to Use This Skill
Use this skill when:
- User asks "what should I build next?"
- User proposes a new feature or idea
- User needs help prioritizing their roadmap
- User is unsure if a feature is worth building
- User wants to evaluate multiple feature ideas
- User mentions feeling overwhelmed by feature requests
- User is making strategic product decisions

Triggers: "roadmap", "what to build", "should I add", "feature idea", "prioritize", "next steps", "product strategy"

## Core Prioritization Framework

### Impact vs Effort Matrix
Always evaluate features on two dimensions:
- **Impact**: How much will this move key metrics? (High/Medium/Low)
- **Effort**: How much time/complexity to build? (High/Medium/Low)

**Priority Order:**
1. **Quick Wins** - High Impact, Low Effort (BUILD THESE FIRST)
2. **Major Projects** - High Impact, High Effort (plan carefully)
3. **Fill-Ins** - Low Impact, Low Effort (only if excess capacity)
4. **Time Sinks** - Low Impact, High Effort (AVOID THESE)

### Category Hierarchy (in order of importance)
When evaluating features, apply this priority order:

1. **Retention** - Features that keep users coming back
   - Fix pain points causing churn
   - Improve core workflow friction
   - Add hooks that create habits

2. **Core Features** - Essential functionality for the main use case
   - Complete the core loop
   - Remove blockers to core value
   - Make the core experience excellent

3. **Monetization** - Features that drive revenue
   - Enable payment/upgrade flows
   - Add premium capabilities
   - Reduce payment friction

4. **Growth** - Features that attract new users
   - Sharing/viral mechanics
   - Onboarding improvements
   - Marketing/SEO features

**Critical Rule**: Never skip categories. Don't build Growth features if Retention is broken.

## Stage-Based Decision Rules

### Pre-Launch Stage
**Single Rule**: ONLY build core loop features. Nothing else exists.

**Core loop** = The minimum complete cycle of user value:
- User arrives with a problem
- User can solve it with your product
- User gets clear value/outcome
- User would come back to do it again

**Hard "NO" list for pre-launch:**
- ❌ Social features
- ❌ Advanced analytics
- ❌ Admin dashboards beyond basics
- ❌ Integrations
- ❌ Customization options
- ❌ "Nice to have" polish
- ❌ Multiple pricing tiers

**What you CAN build:**
- ✅ The absolute minimum to complete one cycle of value
- ✅ Critical signup/auth flow
- ✅ One payment option (if monetized)

### Post-Launch Stage
**Single Rule**: ONLY build features users explicitly request (multiple times).

**What counts as "explicit request":**
- ✅ User directly asks for it
- ✅ User complains about not having it
- ✅ User mentions a workaround they're using
- ✅ User churns because of missing feature

**What DOESN'T count:**
- ❌ "Users would probably like this"
- ❌ "Industry best practice"
- ❌ Competitor has it
- ❌ One user mentioned it once
- ❌ You think it's cool

**Validation threshold**: Wait for 3-5 different users to request the same thing before building.

### Growth Phase
**Rule**: Only build features that reduce churn OR increase organic sharing.

**Churn reduction features:**
- Fix friction points where users drop off
- Add missing capabilities causing cancellations
- Improve onboarding completion rates
- Enhance core workflow satisfaction

**Sharing/Growth features:**
- Make outcomes naturally shareable
- Add collaboration that requires invites
- Build in public/social components
- Create network effects

**Still avoid:**
- Vanity metrics features
- "Would be cool" ideas
- Premature scale optimizations
- Features for imaginary future users

## The Three Validation Questions

Before committing to ANY feature, ask and answer these questions:

### 1. Does this serve the core use case?
- What is the MAIN reason users hire your product?
- Does this feature directly support that reason?
- Or is it a tangent that sounds good but distracts?

**Red flag answers:**
- "It would be nice to have"
- "Other products have it"
- "It might help with [secondary use case]"

**Green flag answers:**
- "Users can't complete [core task] without it"
- "This removes the biggest friction in [core workflow]"
- "Users are churning specifically because of this gap"

### 2. Will users actually use this or just say they want it?
The "say/do gap" is real. Users often request features they won't actually use.

**How to validate:**
- Have they asked for it multiple times?
- Can they describe WHEN they'd use it?
- Are they currently using a workaround?
- Would they pay specifically for this?

**Warning signs:**
- Vague use case descriptions
- "It would be convenient" language
- Can't explain current painful workaround
- Only one user wants it

**Strong signals:**
- Multiple users have the same specific pain
- Users have built makeshift solutions
- Users mention it during churn interviews
- Users are willing to beta test

### 3. Can we fake it first to validate demand?
Before building anything complex, test if users actually want it.

**Fake-it validation methods:**
- Manual workflows (do it for users manually)
- Waitlist for the feature
- "Coming soon" button that gauges interest
- Concierge MVP (high-touch, manual version)
- Landing page with signup for the feature

**Build only after:**
- Manual version proves demand
- Users actually use the fake version
- Volume justifies automation
- You've learned what they really need

## Red Flags Checklist

Stop immediately if you detect ANY of these:

### Feature Creep
- [ ] Building because it's "cool" or technically interesting
- [ ] Adding complexity without user demand
- [ ] "While we're at it" additions to projects
- [ ] Features that don't fit the core value prop
- [ ] Scope expanding mid-project

### Premature Optimization
- [ ] Scaling for users you don't have
- [ ] Building for edge cases before handling the common case
- [ ] Infrastructure work with no immediate user benefit
- [ ] Performance optimization without performance problems
- [ ] Building flexibility for hypothetical future needs

### Imaginary Users
- [ ] "Users will want this once they see it"
- [ ] Building for how you think users work vs how they actually work
- [ ] Assuming user behavior without validation
- [ ] Features for "professional users" when you have none
- [ ] Copying competitors without understanding why

### Other Warning Signs
- [ ] No clear success metric for the feature
- [ ] Can't explain it simply to a 10-year-old
- [ ] Takes more than a sentence to describe
- [ ] Requires user education/onboarding
- [ ] Dependencies on multiple other features

## How Claude Should Use This Skill

### When User Asks "What Should I Build Next?"

**Step 1: Understand Current Stage**
- Ask: "What stage are you in? Pre-launch, post-launch, or growth phase?"
- If unclear, ask about current user count and core loop completion

**Step 2: Inventory Context**
- What's the core use case?
- What are current user pain points?
- What have multiple users explicitly requested?
- What's causing churn?

**Step 3: Apply Framework**
- Use stage-based rules to filter options
- Apply category hierarchy (Retention > Core > Monetization > Growth)
- Evaluate using Impact vs Effort matrix
- Identify Quick Wins

**Step 4: Make Recommendation**
- Be opinionated and direct
- Recommend ONE thing (maybe two) to focus on
- Explain the "why" using the framework
- Challenge any non-qualifying ideas

### When User Proposes a Feature Idea

**Step 1: Ask the Three Questions**
Go through each validation question explicitly:
1. Does this serve the core use case?
2. Will users actually use this?
3. Can we fake it first?

**Step 2: Check Red Flags**
Identify any red flags from the checklist

**Step 3: Assess Priority**
- What category does it fall into?
- What's the Impact vs Effort?
- Does it match their current stage?

**Step 4: Give Direct Feedback**
- If it's good: Explain why and suggest validation approach
- If it's questionable: Challenge with specific concerns
- If it's bad: Say no clearly and suggest what to focus on instead

### When Helping Prioritize Multiple Features

**Step 1: Categorize Everything**
Sort features into: Retention, Core, Monetization, Growth

**Step 2: Apply Stage Filter**
Remove anything that doesn't fit current stage

**Step 3: Matrix Mapping**
Plot remaining items on Impact vs Effort matrix

**Step 4: Build Priority List**
1. High Impact, Low Effort (Quick Wins)
2. High Impact, High Effort (Major Projects - pick ONE)
3. Everything else goes to backlog

**Step 5: Recommend Focus**
- Suggest focusing on top 1-3 items only
- Explain why others should wait
- Suggest validation methods before building

## Example Conversations

### Example 1: Pre-Launch Feature Creep

**User**: "I'm building a task manager. Should I add team collaboration features before launching?"

**Claude Response**:
"No - you're pre-launch, which means ONLY core loop features. 

Your core loop is:
1. User has tasks
2. User adds/completes tasks
3. User feels productive

Team features don't complete this loop - one person can get full value alone. That makes it a Growth feature, not Core.

What have you built so far? Let's make sure your solo task management experience is excellent first. Once you have users actually using it daily, THEN you'll know if collaboration is what they need."

### Example 2: Validating Real Demand

**User**: "Five users asked for a dashboard with analytics. Should I build it?"

**Claude Response**:
"Let's validate if they'll actually use it:

1. What specific metrics do they want to see?
2. What decision will they make differently with this data?
3. Are they currently exporting data manually to track this?

If they can't answer these specifically, they might just think 'dashboards = professional product.'

Fake-it test: Create a simple email report with the key metrics. Send it weekly. If they engage with it consistently for a month, then automate with a dashboard. If they ignore the emails, you just saved yourself weeks of building something nobody uses."

### Example 3: Category Hierarchy Challenge

**User**: "I want to add social sharing to increase signups, but I'm also seeing users churn after day 3."

**Claude Response**:
"Stop. Retention trumps Growth in the hierarchy.

You have a leaky bucket - pouring more water (new signups) won't help. Fix the leak first.

Dig into that day-3 churn:
- What are users trying to do when they leave?
- What friction exists in the core workflow?
- What's missing that they expected?

Don't build Growth features until Retention is healthy. A good target: 30%+ of users still active after 7 days.

Once retention is solid, THEN growth features will actually compound instead of churning out immediately."

### Example 4: Impact vs Effort Reality Check

**User**: "I'm thinking of rebuilding our search with AI semantic search. Current search is basic but works."

**Claude Response**:
"Let's matrix this:
- Impact: How many users complain about search? Is it causing churn?
- Effort: Semantic search = high complexity (embeddings, vector DB, tuning)

If users aren't complaining, this is likely Low Impact, High Effort = TIME SINK.

Question: What problem would amazing search solve that current search doesn't? If you can't point to specific user pain or lost revenue, this is premature optimization.

What are users actually complaining about? That's where the Quick Wins live."

### Example 5: Post-Launch Discipline

**User**: "We launched 3 weeks ago. I have 12 feature ideas I'm excited about."

**Claude Response**:
"Narrow focus is your superpower at this stage.

Post-launch rule: ONLY build what users explicitly request. Out of your 12 ideas, how many have come from actual user feedback (not your imagination)?

Here's your process:
1. Talk to every user you can
2. Document what they struggle with
3. When 3-5 different users mention the same pain → that's your next feature
4. Everything else goes to 'ideas.txt'

Your 12 ideas might all be great, but you don't have the data yet. Let real usage tell you what matters. 

What feedback have you gotten from users so far?"

## Communication Style

When using this skill, Claude should:

- **Be direct and opinionated** - Don't waffle. Give clear "build this" or "don't build this" advice
- **Challenge weak reasoning** - If the user is falling for feature creep, call it out
- **Ask pointed questions** - Surface assumptions and validate demand
- **Reference the framework explicitly** - Use terms like "Quick Win," "Time Sink," "core loop"
- **Say "no" clearly** - Don't soften bad ideas with "maybe" or "could work"
- **Focus them** - Always push toward doing LESS, not more
- **Be pragmatic** - Favor validation over speculation

**Avoid:**
- Listing many options (creates decision paralysis)
- "It depends" without pressing for specifics
- Validating ideas just to be nice
- Suggesting complex solutions when simple ones exist

## Key Principles to Reinforce

1. **Do less, better** - One excellent feature beats five mediocre ones
2. **Users lie, usage doesn't** - Watch behavior, not opinions
3. **Fake it before you make it** - Validate before building
4. **Stage-appropriate building** - What's right at each phase differs
5. **Category discipline** - Fix retention before chasing growth
6. **Impact over effort** - Time is your most limited resource
7. **Core loop obsession** - Everything serves the core use case

## Success Metrics

This skill is working when:
- User builds fewer features but with higher impact
- User can articulate why they're building something
- User validates demand before coding
- User says "no" to feature creep
- User focuses on one thing at a time
- User's roadmap aligns with their stage

This skill is NOT working when:
- User is building lots of features nobody requested
- User can't explain impact of features
- User is jumping between many projects
- User is optimizing prematurely
- User is copying competitors without reasoning
