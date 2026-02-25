#!/usr/bin/env node
/**
 * check-root-files.js
 *
 * Prevents screenshots, generated docs, and other artifacts from being
 * committed to the repository root. Only explicitly allowed files may exist
 * there as .md / image files.
 */

import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

// Only these files are permitted in the repo root.
const ALLOWED_ROOT_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'claude-progress.md',
  'feature_list.json',
]);

// File extensions considered "artifacts" that must not land in root.
const BLOCKED_EXTENSIONS = new Set([
  '.md',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
]);

function getStagedAddedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=A', {
      encoding: 'utf8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function isRootLevel(filePath) {
  return !filePath.includes('/');
}

function isBlockedType(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
}

const stagedFiles = getStagedAddedFiles();
const violations = stagedFiles.filter(
  (f) => isRootLevel(f) && isBlockedType(f) && !ALLOWED_ROOT_FILES.has(f)
);

if (violations.length === 0) {
  console.log(`${colors.green}✓ Root file check passed${colors.reset}`);
  process.exit(0);
}

console.error(`\n${colors.red}✗ Root file check failed${colors.reset}`);
console.error(
  `${colors.yellow}The following files must not be added to the repository root:${colors.reset}`
);
violations.forEach((f) => console.error(`  • ${f}`));
console.error(`
${colors.yellow}Only these files are allowed in root:${colors.reset}
  ${[...ALLOWED_ROOT_FILES].join(', ')}

Move the file to an appropriate directory:
  • Docs / guides   → docs/
  • Planning docs   → docs/plans/
  • Test screenshots → tests/screenshots/ or docs/tests/
  • Test fixtures    → tests/fixtures/
  • PR templates    → .github/
`);
process.exit(1);
