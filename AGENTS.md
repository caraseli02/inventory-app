# AGENTS.md

Agent instructions for working in this repository.

## Canonical Docs

- `docs/project-status.md` is the canonical current-status and handoff document.
- `docs/plans/` is the implementation record.
- `docs/solutions/` is the resolved-problem memory layer.
- `feature_list.json` is structured feature/test tracking, not the handoff layer.
- `docs/project/claude-progress.md` is deprecated and only kept as a redirect.

## Required Workflow

- Update `docs/project-status.md` in every PR that changes shipped behavior, active priorities, roadmap order, or the meaning of "what's next".
- If a new plan becomes active, add it to `docs/project-status.md` in the same PR.
- If work moves from active to completed, update `docs/project-status.md` and link the merged plan and any relevant solution doc.
- Keep `docs/project-status.md` short and current. Replace stale bullets instead of appending long logs.

## PR / Merge Rules

- `pnpm pr:sync-body` must be run before or immediately after opening a PR so the required PR template sections are present.
- The PR body must include the `Project Status` section.
- CI enforces that `docs/project-status.md` is updated in pull requests.
- CI is the release gate. `docs/project-status.md` is the handoff layer, not release authority.

## Testing / Tracking

- Update `feature_list.json` when feature implementation/test booleans change.
- Update `docs/project-status.md` when the PR changes current handoff reality.
- Do not use `docs/project/claude-progress.md` as an active tracker.
