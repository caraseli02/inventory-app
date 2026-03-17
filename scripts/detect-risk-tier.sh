#!/bin/bash
# Risk tier detection for CI policy
# Outputs: risk_tier, requires_deploy_checklist, requires_full_tests, advisory_mode

set -euo pipefail

BASE_BRANCH="${1:-main}"
PR_LABELS="${2:-}"
BEFORE_SHA="${3:-}"
AFTER_SHA="${4:-}"
POLICY_MODE="${RISK_POLICY_MODE:-enforce}" # advisory|enforce

get_changed_files() {
  # Push event range is the most reliable source when available.
  if [ -n "$BEFORE_SHA" ] && [ -n "$AFTER_SHA" ] && [ "$BEFORE_SHA" != "0000000000000000000000000000000000000000" ]; then
    git diff --name-only "$BEFORE_SHA" "$AFTER_SHA" 2>/dev/null && return
  fi

  # PR/default path against base branch.
  if git diff --name-only "origin/$BASE_BRANCH"...HEAD 2>/dev/null; then
    return
  fi

  # Last-resort local fallback.
  git diff --name-only HEAD~1...HEAD 2>/dev/null || true
}

CHANGED_FILES="$(get_changed_files)"

# Safety fallback for empty diff outputs.
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES="$(git diff --name-only HEAD~1...HEAD 2>/dev/null || true)"
fi

risk_tier="low"
requires_deploy_checklist="false"
requires_full_tests="false"

promote_medium() {
  if [ "$risk_tier" = "low" ]; then
    risk_tier="medium"
  fi
}

promote_high() {
  risk_tier="high"
  requires_deploy_checklist="true"
  requires_full_tests="true"
}

# Label-based promotion (optional)
if echo "$PR_LABELS" | grep -qiE 'deploy|release|high-risk'; then
  promote_high
fi
if echo "$PR_LABELS" | grep -qiE 'feature|refactor|medium-risk'; then
  promote_medium
fi

# File-based promotion (source of truth)
while IFS= read -r file; do
  [ -z "$file" ] && continue

  case "$file" in
    # Deploy/config/workflow changes
    .github/workflows/*|vercel.json|vite.config.ts|playwright.config.ts|playwright.visual.config.ts|vitest.config.ts|package.json|pnpm-lock.yaml|tsconfig*.json)
      promote_high
      ;;

    # Critical runtime and integration domains
    src/lib/invoice*|src/lib/supabase*|src/lib/api-provider.ts|src/lib/api.ts|src/lib/airtable.ts|src/lib/imageUpload.ts|api/*|supabase/functions/*|lib/whatsapp/*|mcp/*)
      promote_high
      ;;

    # Typical app logic and feature paths
    src/lib/*|src/hooks/*|src/pages/*|src/components/*|tests/*|lib/*)
      promote_medium
      ;;

    # Docs-only and metadata can stay low
    docs/*|README.md|CLAUDE.md|AGENTS.md)
      ;;
  esac

done <<< "$CHANGED_FILES"

advisory_mode="false"
if [ "$POLICY_MODE" = "advisory" ]; then
  advisory_mode="true"
fi

echo "Detected risk tier: $risk_tier"
echo "Policy mode: $POLICY_MODE"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "risk_tier=$risk_tier"
    echo "requires_deploy_checklist=$requires_deploy_checklist"
    echo "requires_full_tests=$requires_full_tests"
    echo "advisory_mode=$advisory_mode"
  } >> "$GITHUB_OUTPUT"
fi
