---
status: pending
priority: p2
issue_id: "142"
tags: [code-review, documentation, dx, tooling]
dependencies: []
---

# search-solutions.js has 3 scoring bugs reducing search relevance

## Problem Statement
`scripts/search-solutions.js` has three bugs that degrade search result quality: (1) recency bonus applied per query term instead of per document (inflates multi-word queries), (2) summary extraction returns section headings (`# Problem Description`) not the actual problem text, (3) no filename-based search despite filenames being well-structured.

## Findings

**Bug 1: Recency bonus inside forEach loop (lines 82-87)**
```javascript
qTerms.forEach(term => {
  // ... scoring ...
  score += 2; // ← recency applied per term
});
```
A 3-term query against a recent doc scores +6 from recency; a 1-term query scores +2. Recent but weakly relevant docs inflate artificially in multi-word searches.

**Bug 2: Summary extraction returns headings (lines 129-136)**
```javascript
const summary = body.trim().split('\n').slice(0, 2).join(' ');
```
Every solution body starts with `# Problem Description` or `# Problem Statement`. Summary field in search output is always one of those two strings — never the actual problem description.

**Bug 3: Filename not scored**
`filename` is read into the result (line 43) but never added to scoring. WhatsApp solutions all have `WhatsAppAgent` in the filename. A query for `"webhook"` only matches via body text, not filename.

## Proposed Solutions

### Option A: Fix all 3 bugs (Recommended)
1. Move recency block outside `qTerms.forEach`:
   ```javascript
   // after forEach
   const daysSinceDoc = (Date.now() - new Date(fm.date).getTime()) / (1000*60*60*24);
   if (daysSinceDoc < 30) score += 2;
   ```
2. Fix summary extraction to skip `#` headings:
   ```javascript
   const summary = body.split('\n')
     .filter(l => l.trim() && !l.startsWith('#'))
     .slice(0, 2).join(' ');
   ```
3. Add filename scoring (+3 if filename contains a query term)
- Effort: Small

## Technical Details
- Affected file: `scripts/search-solutions.js`
- Lines: 82-87 (recency), 129-136 (summary), ~45-93 (scoring loop)

## Acceptance Criteria
- [ ] `node scripts/search-solutions.js --query "whatsapp pending order"` returns summaries with actual problem text
- [ ] A 3-term query against a recent doc scores recency bonus of +2 (not +6)
- [ ] A query for `"webhook"` scores higher for files with `webhook` in filename

## Work Log
- 2026-03-17: Identified by kieran-typescript-reviewer and agent-native-reviewer agents in ce-review
