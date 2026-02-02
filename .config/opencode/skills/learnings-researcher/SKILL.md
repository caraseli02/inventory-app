---
name: Learnings Researcher
description: Search the docs/solutions knowledge base for existing solutions to problems.
---

# Learnings Researcher

This skill allows you to search the `docs/solutions/` knowledge base for resolved issues.
Use this when you encounter a bug or error to see if it has been solved before.

## Usage

Run the search script with your query.

```bash
node scripts/search-solutions.js --query "your search terms"
```

The output will be a JSON list of top 3 related solutions.
If matches are found, **read the linked files** to understand the solution.

## Example

Query: "scanner loop"
Command: `node scripts/search-solutions.js --query "scanner loop"`
Output:
```json
[
  {
    "score": 45,
    "module": "ScannerComponent",
    "path": "docs/solutions/scanner-issues/scanner-infinite-loop.md",
    "problem_type": "scanner_issue",
    "component": "scanner",
    "severity": "high",
    "summary": "Scanner component was re-initializing on every render..."
  }
]
```
