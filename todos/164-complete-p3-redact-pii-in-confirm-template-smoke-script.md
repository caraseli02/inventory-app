---
status: complete
priority: p3
issue_id: "164"
tags: [code-review, whatsapp, twilio, dx, security]
dependencies: []
---

# Redact values in confirmation template smoke script output

## Problem Statement

The confirmation-template smoke script logs full `ContentVariables` (product names, pickup time, etc.) and a chunk of Twilio response. In shared terminals or CI logs, this can become accidental PII leakage.

## Findings

- [scripts/test-twilio-template.ts](/Users/vladislavcaraseli/Documents/inventory-app/scripts/test-twilio-template.ts) prints the entire variables payload and response prefix.

## Proposed Solutions

### Option 1: Default redaction + `--verbose` flag (recommended)

**Approach:** Print only variable keys and value lengths by default; add `--verbose` to print full payload when explicitly requested.

**Pros:**
- Safe-by-default
- Still debuggable when needed

**Cons:**
- Slightly more code

**Effort:** 30-60 min

**Risk:** Low

---

### Option 2: Keep logs but enforce synthetic placeholders

**Approach:** Hardcode variables to synthetic values and refuse overrides.

**Pros:**
- Eliminates PII risk entirely

**Cons:**
- Less useful for debugging real-world template shape

**Effort:** 15-30 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] Running the script does not print full customer-like values by default.
- [ ] There is an explicit opt-in for full payload logging when needed.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Reviewed the new confirm-template-only smoke script output.
