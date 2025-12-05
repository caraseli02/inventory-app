# Marketing Writer Skill

## Purpose
Generate authentic marketing content by analyzing your codebase to understand your product's features, value proposition, and technical implementation. Write in a casual, direct voice that focuses on real benefits without corporate buzzwords.

## When to Use This Skill
- Writing landing page content for new features
- Creating tweet threads to announce releases
- Drafting launch emails
- Explaining technical features in simple terms
- Marketing any product updates or improvements

## Brand Voice Principles
1. **Casual and direct** - Talk like a friend, not a corporation
2. **No buzzwords** - Avoid "revolutionary," "cutting-edge," "leverage," "synergy," etc.
3. **Real benefits** - Focus on what users actually get, not marketing hype
4. **Simple language** - No jargon unless your audience expects it

## Workflow

### 1. Understand the Codebase
Before writing any marketing content, analyze the codebase to extract:

```bash
# Read key files to understand the product
view /home/claude  # Start with project structure
view package.json  # Understand dependencies and project metadata
view README.md     # Check for existing product description
view app/          # or pages/ - Understand routes and features
view components/   # Identify key UI components and features
view lib/          # or utils/ - Understand core functionality
```

**Extract this information:**
- **What the app does** - Core purpose in one sentence
- **Key features** - List of main features users can access
- **Tech stack** - Framework, libraries, integrations
- **User pain points** - What problem does this solve?
- **Unique value** - What makes this different from alternatives?

### 2. Generate Marketing Content

Use the templates below, adapting them based on what you learned from the codebase.

---

## Template 1: Landing Page Feature Section

**Format: Problem → Solution → Benefit**

```markdown
## [Feature Name]

[Describe the annoying problem in 1-2 sentences. Make it relatable.]

[Explain how your feature solves it in simple terms. Focus on the "what" not the "how".]

[State the clear benefit. What can users do now that they couldn't before?]
```

**Example:**
```markdown
## Real-time Collaboration

Tired of refreshing the page to see if your teammate made changes? Or worse, overwriting each other's work?

See updates instantly as your team edits. No refresh needed, no conflicts, no confusion.

Work together like you're sitting at the same desk, even when you're not.
```

---

## Template 2: Tweet Thread

**Format: Hook → Credibility → Value → CTA**

```markdown
1/ [Hook: Bold statement or relatable problem]

2/ [Build credibility: Quick context on why you built this]

3/ [Show the feature: What it does in simple terms]

4/ [Demonstrate value: Specific benefit or use case]

5/ [Optional: Another benefit or feature detail]

6/ [CTA: Link to try it + brief encouragement]
```

**Example:**
```markdown
1/ Shipping features shouldn't mean breaking your app for 10% of users.

2/ We just shipped feature flags to our dashboard. Took us 2 days to build because we kept it stupidly simple.

3/ Turn features on/off per user or by percentage. No deploy needed. Works with any framework.

4/ Launch to 5% of users first. See if anything breaks. If it's good, roll it out to everyone. If not, flip it off instantly.

5/ No complex SDKs, no vendor lock-in. Just a simple API that works with your existing setup.

6/ Try it free at [link]. First 1000 flags are on us.
```

---

## Template 3: Launch Email

**Format: Personal → Specific Value → Easy CTA**

```markdown
Subject: [Simple, direct subject about the benefit]

Hey [Name/there],

[Personal opening: Why you built this, 1-2 sentences]

[Describe the feature in plain English, focus on what it does for them]

[Specific example or use case that makes it concrete]

[Clear, easy CTA with no friction]

[Sign off]
[Your name]

P.S. [Optional: Quick tip or additional detail]
```

**Example:**
```markdown
Subject: No more "it works on my machine"

Hey there,

Got tired of debugging environment issues on support calls, so we built preview deployments.

Every git push gets its own URL. Share it with your team, client, or QA. They see exactly what you see.

Instead of explaining the bug over Slack, just send the preview link. Everyone's looking at the same thing.

Try it: push your next branch and check the comment on your PR.

– Alex

P.S. These links expire after 7 days to keep your project clean
```

---

## Writing Guidelines

### DO:
- Use "you" and "your" to speak directly to users
- Lead with the benefit, not the feature
- Keep sentences short (under 20 words when possible)
- Use specific examples instead of vague claims
- Test if your content makes sense to someone who doesn't know your product

### DON'T:
- Use exclamation marks excessively!!!
- Say "we're excited to announce" (nobody cares if you're excited)
- Use words like: revolutionary, game-changing, cutting-edge, next-generation, innovative
- Explain technical implementation unless it's the selling point
- Make promises you can't keep

### Replace Buzzwords With Simple Language:

| ❌ Don't Say | ✅ Say Instead |
|-------------|----------------|
| "Leverage our platform" | "Use our tool" |
| "Seamless integration" | "Works with [specific thing]" |
| "Robust solution" | "It works reliably" |
| "Empower users" | "Let users [do specific thing]" |
| "Best-in-class" | "Better than [competitor] because [reason]" |
| "Cutting-edge" | Describe the actual feature |
| "Revolutionary" | Just describe what it does |

---

## Example Workflow

```
User: "I just added dark mode to my app. Write a tweet about it."

Claude's Process:
1. Read codebase to understand the app type and tech stack
2. Identify how dark mode was implemented (theme toggle, system preference detection, etc.)
3. Think about user benefit (easier on eyes, battery saving, preference)
4. Write tweet using the template, focusing on benefit not implementation

Output:
"Staring at your dashboard at 2am shouldn't burn your retinas.

Dark mode is live. Switches automatically based on your system preference, or toggle it manually.

Your eyes (and your battery) will thank you.

Try it: [link]"
```

---

## Adapting to Different Products

### For Developer Tools:
- Focus on time saved and frustration removed
- Use before/after comparisons
- Technical details are okay if they're the selling point
- Show code examples if relevant

### For User-Facing Apps:
- Focus on end-user benefits, not technical features
- Use emotional language (save time, reduce stress, feel confident)
- Show clear before/after scenarios
- Make it feel accessible to non-technical users

### For B2B Products:
- Focus on team benefits and business impact
- Mention time/money saved with specifics
- Address common objections upfront
- Include social proof if available

---

## Quick Reference Checklist

Before publishing marketing content, verify:

- [ ] Would this make sense to someone who's never heard of your product?
- [ ] Did you lead with the benefit, not the feature name?
- [ ] Could you remove any buzzwords and still say the same thing?
- [ ] Is there a clear next step for the reader?
- [ ] Would you talk like this to a friend at a coffee shop?
- [ ] Did you explain what it does, not just how cool it is?

---

## Integration with Your Workflow

When you say things like:
- "Write marketing copy for [feature]"
- "I just shipped [feature], announce it"
- "Write a landing page for [feature]"
- "Create a tweet about [feature]"

Claude will:
1. Automatically read your codebase to understand context
2. Identify the feature and its implementation
3. Extract the core value proposition
4. Generate content using the appropriate template
5. Apply your brand voice principles
6. Keep it casual, direct, and benefit-focused

---

## Notes

- This skill works best when your codebase has clear feature implementations
- Update this skill if your brand voice evolves
- Consider A/B testing different approaches to find what resonates with your audience
- Save successful examples to refine the templates over time
