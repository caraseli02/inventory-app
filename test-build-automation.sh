#!/bin/bash
# Test script for Vercel build automation

echo "🧪 Testing Vercel Build Automation..."
echo ""
echo "This script will:"
echo "1. Create a test branch"
echo "2. Introduce a TypeScript error"
echo "3. Push to GitHub"
echo "4. Wait for Vercel to fail"
echo "5. Watch Claude auto-fix it!"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Create test branch
BRANCH="test/auto-fix-demo-$(date +%s)"
git checkout -b "$BRANCH"

# Add a TypeScript error
cat > src/test-auto-fix.ts << 'TSEOF'
// This file intentionally has a type error to test auto-fix
const incorrectType: string = 123; // ❌ This will fail TypeScript compilation

export const testValue = incorrectType;
TSEOF

# Commit and push
git add src/test-auto-fix.ts
git commit -m "test: Intentional build error to test auto-fix workflow"
git push -u origin "$BRANCH"

echo ""
echo "✅ Test branch pushed: $BRANCH"
echo ""
echo "Next steps:"
echo "1. Go to: https://github.com/$(git remote get-url origin | sed 's/.*github.com[\/:]//' | sed 's/\.git$//')/actions"
echo "2. Watch the 'Auto-fix Vercel Build Failures' workflow"
echo "3. Claude will automatically fix the error and commit"
echo "4. Check the commit history to see the automated fix"
echo ""
echo "Clean up after testing:"
echo "  git checkout main"
echo "  git branch -D $BRANCH"
echo "  git push origin --delete $BRANCH"
