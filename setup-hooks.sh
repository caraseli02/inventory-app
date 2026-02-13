#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Setting up git hooks..."
echo ""
echo "This repo uses simple-git-hooks (package.json -> pre-commit)."
echo ""
echo "1) Install deps (installs hooks via prepare):"
echo "   pnpm install"
echo ""
echo "2) Reinstall hooks manually if needed:"
echo "   pnpm prepare"
echo ""
echo "If hooks still don't run, check git config core.hooksPath:"
echo "   git config --get core.hooksPath"
