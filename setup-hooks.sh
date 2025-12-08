#!/bin/bash
# Setup git hooks for pre-commit checks

echo "🔧 Setting up git hooks..."

# Make the hook executable
chmod +x .githooks/pre-commit

# Install the hook
cp .githooks/pre-commit .git/hooks/pre-commit

echo "✅ Pre-commit hook installed!"
echo ""
echo "Now TypeScript and lint checks will run automatically before each commit."
echo "To bypass (not recommended): git commit --no-verify"
