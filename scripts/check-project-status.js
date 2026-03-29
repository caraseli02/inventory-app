#!/usr/bin/env node

import { execSync } from 'child_process';

const STATUS_DOC = 'docs/project-status.md';

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function getChangedFiles() {
  const baseRef = process.argv[2];

  if (baseRef) {
    return run(`git diff --name-only origin/${baseRef}...HEAD`)
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  }

  const before = process.env.BEFORE_SHA;
  const after = process.env.AFTER_SHA;

  if (before && after) {
    return run(`git diff --name-only ${before} ${after}`)
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  }

  const workingTree = run('git diff --name-only HEAD');
  const staged = run('git diff --cached --name-only');
  const untracked = run('git ls-files --others --exclude-standard');

  return [...workingTree.split('\n'), ...staged.split('\n'), ...untracked.split('\n')]
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file, index, files) => files.indexOf(file) === index);
}

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('No changed files detected; skipping project status check.');
    return;
  }

  const nonStatusChanges = changedFiles.filter((file) => file !== STATUS_DOC);

  if (nonStatusChanges.length === 0) {
    console.log(`Only ${STATUS_DOC} changed; project status check passed.`);
    return;
  }

  if (changedFiles.includes(STATUS_DOC)) {
    console.log(`Found ${STATUS_DOC} in diff; project status check passed.`);
    return;
  }

  console.error(`Project status check failed: ${STATUS_DOC} was not updated in this change set.`);
  console.error('Every PR must refresh the canonical status doc so handoffs and merge context stay current.');
  console.error('Changed files:');
  for (const file of nonStatusChanges) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

main();
