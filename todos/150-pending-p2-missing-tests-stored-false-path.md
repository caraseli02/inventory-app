---
status: pending
priority: p2
issue_id: "150"
tags: [code-review, whatsapp, testing, error-handling]
dependencies: ["149"]
---

# Missing tests for `storePendingProductSelection` false-return paths in selection-resolver.ts

## Problem Statement

PR #173 added `stored === false` abort guards to 4 callers in `selection-resolver.ts`. The mock in `whatsapp-selection-resolver.test.ts` now correctly returns `true`, but there are zero tests that exercise the `false` path. The most critical untested case is `handleQtyInput`: it returns `true` (intercepted) after the error branch, which is non-obvious — a test would prevent someone from changing `return true` to `return false` without realizing they'd break the interception contract.

## Findings

- `lib/whatsapp/selection-resolver.ts`:
  - `handleCategorySelected` lines 102–105: `if (!stored) { sendRestMessage(...); return; }` — untested
  - `handleProductSelected` lines 133–136: `if (!stored) { sendRestMessage(...); return; }` — untested
  - `sendCategoryPicker` lines 185–188: `if (!stored) { sendRestMessage(...); return false; }` — untested
  - `handleQtyInput` lines 245–248: `if (!stored) { sendRestMessage(...); return true; }` — untested. The `return true` here signals "message intercepted even on failure" and is load-bearing for the state machine.
- `tests/unit/lib/whatsapp-selection-resolver.test.ts`: mock always returns `true` — no test configures it to return `false`

## Proposed Solutions

### Option A: Add vitest cases per handler (Recommended)
For each handler, add a test that configures the mock to return `false` and asserts:
1. The error message was sent via `sendRestMessage`
2. The function returned the expected value (`undefined` for void handlers, `true` for `handleQtyInput`)
3. The downstream template/message was NOT sent

```typescript
it('handleQtyInput sends error and returns true when storePendingProductSelection fails', async () => {
  vi.mocked(storePendingProductSelection).mockResolvedValueOnce(false);
  const result = await handleQtyInput({ sb, from, phone, text: '2' });
  expect(result).toBe(true); // intercepted
  expect(sendRestMessage).toHaveBeenCalledWith(from, 'A apărut o eroare. Încearcă din nou.');
  // template NOT sent
  expect(sendTemplateMessage).not.toHaveBeenCalled();
});
```

- Effort: Small (4 tests)
- Risk: None

### Option B: Parameterize existing tests
Add a `stored: false` variant to existing test suites via `describe.each`. Fewer files but harder to read.

**Recommended**: Option A — explicit tests are more readable given the non-obvious `return true` behavior.

## Technical Details
- Test file: `tests/unit/lib/whatsapp-selection-resolver.test.ts`
- Mock to configure: `storePendingProductSelection: vi.fn(async () => { ... return true/false })`

## Acceptance Criteria
- [ ] `handleQtyInput` false-path: test verifies `return true` AND no template sent
- [ ] `sendCategoryPicker` false-path: test verifies `return false` AND `sendRestMessage` called
- [ ] `handleCategorySelected` false-path: test verifies early return AND no `sendListPickerTemplate`
- [ ] `handleProductSelected` false-path: test verifies early return AND no `sendTemplateMessage`

## Work Log
- 2026-03-17: Found by kieran-typescript-reviewer agent in ce-review of PR #173
