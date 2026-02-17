#!/bin/bash
# Intelligent Test Detection Script
# Maps changed files to their corresponding tests to avoid running unnecessary tests

set -e

# Get changed files (comparing against base branch)
BASE_BRANCH="${1:-main}"
BEFORE_SHA="${2:-}"
AFTER_SHA="${3:-}"

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

echo "🔍 Detecting changed files..."
echo "$CHANGED_FILES" | head -10
echo ""

# Flags to track which test categories to run
RUN_UNIT_TESTS=false
RUN_INTEGRATION_TESTS=false
RUN_E2E_TESTS=false
RUN_ALL_TESTS=false

# Specific test files to run
SPECIFIC_TESTS=""

# Check if critical files changed (always run all tests)
if echo "$CHANGED_FILES" | grep -qE "package\.json|tsconfig\.json|vite\.config|vitest\.config|playwright\.config"; then
  echo "⚠️  Critical config files changed - running ALL tests"
  RUN_ALL_TESTS=true
fi

# Check if test infrastructure changed
if echo "$CHANGED_FILES" | grep -qE "src/test/|\.github/workflows/ci\.yml"; then
  echo "⚠️  Test infrastructure changed - running ALL tests"
  RUN_ALL_TESTS=true
fi

# Map source files to their tests
while IFS= read -r file; do
  case "$file" in
    # Unit tests - lib
    src/lib/errors.ts)
      echo "📝 errors.ts changed → tests/unit/lib/errors.test.ts"
      SPECIFIC_TESTS="$SPECIFIC_TESTS tests/unit/lib/errors.test.ts"
      RUN_UNIT_TESTS=true
      ;;
    src/lib/logger.ts)
      echo "📝 logger.ts changed → tests/unit/lib/logger.test.ts"
      SPECIFIC_TESTS="$SPECIFIC_TESTS tests/unit/lib/logger.test.ts"
      RUN_UNIT_TESTS=true
      ;;
    src/lib/filters.ts)
      echo "📝 filters.ts changed → tests/unit/lib/filters.test.ts"
      SPECIFIC_TESTS="$SPECIFIC_TESTS tests/unit/lib/filters.test.ts"
      RUN_UNIT_TESTS=true
      ;;
    src/lib/ai/*.ts)
      echo "📝 AI module changed → tests/unit/lib/ai.test.ts"
      SPECIFIC_TESTS="$SPECIFIC_TESTS tests/unit/lib/ai.test.ts"
      RUN_UNIT_TESTS=true
      ;;

    # Unit tests - hooks
    src/hooks/useLowStockAlerts.ts)
      echo "📝 useLowStockAlerts hook changed → tests/unit/hooks/useLowStockAlerts.test.tsx"
      SPECIFIC_TESTS="$SPECIFIC_TESTS tests/unit/hooks/useLowStockAlerts.test.tsx"
      RUN_UNIT_TESTS=true
      ;;
    src/hooks/useProductLookup.ts)
      echo "📝 useProductLookup hook changed → integration tests"
      RUN_INTEGRATION_TESTS=true
      ;;

    # Integration tests - API
    src/lib/api-provider.ts|src/lib/supabase-api.ts|src/lib/api.ts)
      echo "📝 API layer changed → tests/integration/api/"
      RUN_INTEGRATION_TESTS=true
      ;;

    # E2E tests - pages and navigation
    src/pages/ScanPage.tsx|src/pages/InventoryListPage.tsx)
      echo "📝 Page component changed → E2E tests"
      RUN_E2E_TESTS=true
      ;;
    src/App.tsx)
      echo "⚠️  App.tsx changed (navigation) → E2E tests"
      RUN_E2E_TESTS=true
      ;;

    # Core components - run all tests (critical path)
    src/components/scanner/*.tsx|src/components/product/*.tsx)
      echo "⚠️  Core component changed - running ALL tests"
      RUN_ALL_TESTS=true
      ;;

    # Test files themselves
    tests/unit/*.test.ts|tests/unit/*.test.tsx)
      echo "📝 Unit test changed → running that test"
      SPECIFIC_TESTS="$SPECIFIC_TESTS $file"
      RUN_UNIT_TESTS=true
      ;;
    tests/integration/*.test.ts)
      echo "📝 Integration test changed → running integration tests"
      RUN_INTEGRATION_TESTS=true
      ;;
    tests/e2e/*.spec.ts)
      echo "📝 E2E test changed → running E2E tests"
      RUN_E2E_TESTS=true
      ;;
  esac
done <<< "$CHANGED_FILES"

# Output test strategy
echo ""
echo "📊 Test Strategy:"
if [ "$RUN_ALL_TESTS" = true ]; then
  echo "  ✅ RUN_ALL_TESTS=true"
  echo "all" > /tmp/test-strategy.txt
elif [ -n "$SPECIFIC_TESTS" ]; then
  echo "  ✅ RUN_SPECIFIC_TESTS=true"
  echo "  Tests to run: $SPECIFIC_TESTS"
  echo "specific" > /tmp/test-strategy.txt
  echo "$SPECIFIC_TESTS" > /tmp/test-files.txt
else
  # Default: run unit and integration if source code changed
  if echo "$CHANGED_FILES" | grep -qE "src/"; then
    echo "  ✅ Source code changed → running unit + integration"
    RUN_UNIT_TESTS=true
    RUN_INTEGRATION_TESTS=true
  fi

  if [ "$RUN_UNIT_TESTS" = true ] || [ "$RUN_INTEGRATION_TESTS" = true ] || [ "$RUN_E2E_TESTS" = true ]; then
    echo "  ✅ RUN_UNIT_TESTS=$RUN_UNIT_TESTS"
    echo "  ✅ RUN_INTEGRATION_TESTS=$RUN_INTEGRATION_TESTS"
    echo "  ✅ RUN_E2E_TESTS=$RUN_E2E_TESTS"
    echo "selective" > /tmp/test-strategy.txt
  else
    echo "  ℹ️  No test-relevant files changed - skipping tests"
    echo "skip" > /tmp/test-strategy.txt
  fi
fi

# Export as GitHub Actions outputs if in CI
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "run_all_tests=$RUN_ALL_TESTS" >> "$GITHUB_OUTPUT"
  echo "run_unit_tests=$RUN_UNIT_TESTS" >> "$GITHUB_OUTPUT"
  echo "run_integration_tests=$RUN_INTEGRATION_TESTS" >> "$GITHUB_OUTPUT"
  echo "run_e2e_tests=$RUN_E2E_TESTS" >> "$GITHUB_OUTPUT"

  if [ -n "$SPECIFIC_TESTS" ]; then
    # Convert space-separated list to JSON array
    TESTS_JSON=$(echo "$SPECIFIC_TESTS" | jq -R -s -c 'split(" ") | map(select(length > 0))')
    echo "specific_tests=$TESTS_JSON" >> "$GITHUB_OUTPUT"
  fi
fi

echo ""
echo "✅ Test detection complete"
