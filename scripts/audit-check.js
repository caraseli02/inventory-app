#!/usr/bin/env node
/**
 * Runs `pnpm audit --json` and exits non-zero if any high+ advisories are found,
 * except for known-unfixable advisories listed in IGNORED_ADVISORIES.
 *
 * xlsx (SheetJS) moved to a proprietary model; the public npm package has no patched
 * versions available. These are accepted risks until xlsx is replaced.
 */

import { execSync } from 'child_process';

const IGNORED_ADVISORIES = new Set([
  'GHSA-4r6h-8v6p-xvw6', // xlsx: Prototype Pollution — no fix on npm
  'GHSA-5pgg-2g8v-p4x9', // xlsx: ReDoS — no fix on npm
]);

let raw;
try {
  raw = execSync('pnpm audit --json --audit-level=high', { encoding: 'utf8' });
} catch (err) {
  // pnpm audit exits non-zero when vulnerabilities are found; capture stdout anyway
  raw = err.stdout || '';
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('Failed to parse pnpm audit output');
  process.exit(1);
}

const advisories = report.advisories || {};
const blocking = Object.values(advisories).filter((adv) => {
  const sev = adv.severity;
  const isHighPlus = sev === 'high' || sev === 'critical';
  return isHighPlus && !IGNORED_ADVISORIES.has(adv.github_advisory_id);
});

if (blocking.length === 0) {
  console.log('✓ No blocking high/critical vulnerabilities found.');
  process.exit(0);
} else {
  console.error(`✗ ${blocking.length} blocking high/critical vulnerabilities:\n`);
  for (const adv of blocking) {
    console.error(`  [${adv.severity}] ${adv.module_name} — ${adv.github_advisory_id}`);
    console.error(`         patched: ${adv.patched_versions}`);
    console.error(`         ${adv.url}`);
  }
  process.exit(1);
}
