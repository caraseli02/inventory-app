#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.resolve(__dirname, '../.github/pull_request_template.md');

const HIGH_RISK_LABELS = [
  'High-Risk Deploy Checklist Completed',
  'Rollback Plan Included',
  'Refactor Regression Proof Added',
];

const DEPLOY_LABELS = [
  'Build and runtime env vars verified',
  'Migration/config compatibility verified',
  'Monitoring/log checks defined',
];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function parseArgs(argv) {
  const args = { check: false, pr: undefined };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') {
      args.check = true;
      continue;
    }
    if (value === '--pr') {
      args.pr = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

function loadTemplateSections(template) {
  const matches = [...template.matchAll(/^## .+$/gm)];
  const sections = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? template.length) : template.length;
    const heading = matches[index][0];
    const content = template.slice(start, end).trim();
    sections.push({ heading, content });
  }

  return sections;
}

function getSectionRange(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^${escaped}$`, 'm');
  const match = headingRegex.exec(body);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const afterHeading = start + match[0].length;
  const nextHeadingMatch = /^## .+$/gm;
  nextHeadingMatch.lastIndex = afterHeading;
  const next = nextHeadingMatch.exec(body);
  const end = next?.index ?? body.length;

  return { start, end };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureSection(body, section) {
  if (body.includes(section.heading)) return body;
  const trimmed = body.trimEnd();
  return `${trimmed}\n\n${section.content}`;
}

function dedupeSection(body, heading) {
  const escaped = escapeRegex(heading);
  const regex = new RegExp(`^${escaped}$`, 'gm');
  const matches = [...body.matchAll(regex)];
  if (matches.length <= 1) return body;

  let nextBody = body;
  for (let index = matches.length - 1; index >= 1; index -= 1) {
    const range = getSectionRange(nextBody, heading);
    if (!range) break;

    const firstRange = range;
    const tail = nextBody.slice(firstRange.end);
    const duplicateRangeInTail = getSectionRange(tail, heading);
    if (!duplicateRangeInTail) break;

    const duplicateStart = firstRange.end + duplicateRangeInTail.start;
    const duplicateEnd = firstRange.end + duplicateRangeInTail.end;
    nextBody = `${nextBody.slice(0, duplicateStart).trimEnd()}\n\n${nextBody.slice(duplicateEnd).trimStart()}`;
  }
  return nextBody.replace(/\n{3,}/g, '\n\n');
}

function getChecklistState(body, label) {
  const pattern = new RegExp(`^\\s*- \\[([ xX])\\] ${escapeRegex(label)}$`, 'gm');
  let match;
  let sawUnchecked = false;

  while ((match = pattern.exec(body)) !== null) {
    if (match[1].toLowerCase() === 'x') return true;
    sawUnchecked = true;
  }

  return sawUnchecked ? false : null;
}

function stripChecklistLines(body, labels) {
  let nextBody = body;
  for (const label of labels) {
    const pattern = new RegExp(`^\\s*- \\[[ xX]\\] ${escapeRegex(label)}\\n?`, 'gm');
    nextBody = nextBody.replace(pattern, '');
  }
  return nextBody.replace(/\n{3,}/g, '\n\n');
}

function inferHighRiskState(body, label) {
  if (label === 'High-Risk Deploy Checklist Completed') {
    const range = getSectionRange(body, '## Deploy Checklist (High-Risk)');
    if (!range) return false;
    const sectionText = body.slice(range.start, range.end);
    return !sectionText.includes('Build and runtime env vars verified')
      ? false
      : /verified:|defined:|no database|no migration|404/.test(sectionText);
  }
  if (label === 'Rollback Plan Included') {
    const range = getSectionRange(body, '## Rollback Plan');
    if (!range) return false;
    const sectionText = body.slice(range.start, range.end);
    return !sectionText.includes('Describe how to safely roll back this change.');
  }
  if (label === 'Refactor Regression Proof Added') {
    const range = getSectionRange(body, '## Refactor Regression Proof');
    if (!range) return false;
    const sectionText = body.slice(range.start, range.end);
    return !sectionText.includes('Describe evidence that behavior is preserved');
  }
  return false;
}

function normalizeChecklistSection(body, heading, labels, options = {}) {
  const states = new Map();
  for (const label of labels) {
    const existing = getChecklistState(body, label);
    const inferred = existing ?? (options.inferState ? options.inferState(body, label) : false);
    states.set(label, inferred);
  }

  const withoutLines = stripChecklistLines(body, labels);
  const range = getSectionRange(body, heading);
  if (!range) {
    const sectionLines = labels.map((label) => `- [${states.get(label) ? 'x' : ' '}] ${label}`);
    return `${withoutLines.trimEnd()}\n\n${heading}\n${sectionLines.join('\n')}`;
  }

  const normalizedRange = getSectionRange(withoutLines, heading);
  if (!normalizedRange) return withoutLines;

  const sectionText = withoutLines.slice(normalizedRange.start, normalizedRange.end).trimEnd();
  const sectionLines = labels.map((label) => `- [${states.get(label) ? 'x' : ' '}] ${label}`);
  const updatedSection = `${sectionText}\n${sectionLines.join('\n')}\n`;
  return `${withoutLines.slice(0, normalizedRange.start)}${updatedSection}${withoutLines.slice(normalizedRange.end)}`;
}

function computeMissing(body, templateSections) {
  const missing = [];

  for (const section of templateSections) {
    if (!body.includes(section.heading)) {
      missing.push(section.heading);
    }
  }

  for (const label of [...HIGH_RISK_LABELS, ...DEPLOY_LABELS]) {
    if (getChecklistState(body, label) === null) {
      missing.push(label);
    }
  }

  return missing;
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`${colors.red}PR template not found at ${TEMPLATE_PATH}${colors.reset}`);
    process.exit(1);
  }

  try {
    runGh(['--version']);
    runGh(['auth', 'status']);
  } catch (error) {
    console.error(`${colors.red}GitHub CLI is required and must be authenticated.${colors.reset}`);
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const templateSections = loadTemplateSections(template);
  const prJson = runGh(['pr', 'view', ...(args.pr ? [args.pr] : []), '--json', 'number,body,url']);
  const pr = JSON.parse(prJson);

  const missingBefore = computeMissing(pr.body, templateSections);
  if (args.check) {
    if (missingBefore.length === 0) {
      console.log(`${colors.green}✓ PR body contains required template sections.${colors.reset}`);
      return;
    }

    console.error(`${colors.red}✗ PR body is missing required content:${colors.reset}`);
    for (const item of missingBefore) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  let nextBody = pr.body.trimEnd();
  for (const section of templateSections) {
    nextBody = ensureSection(nextBody, section);
  }

  for (const section of templateSections) {
    nextBody = dedupeSection(nextBody, section.heading);
  }

  nextBody = normalizeChecklistSection(nextBody, '## High-Risk Requirements', HIGH_RISK_LABELS, {
    inferState: inferHighRiskState,
  });
  nextBody = normalizeChecklistSection(nextBody, '## Deploy Checklist (High-Risk)', DEPLOY_LABELS);

  for (const section of templateSections) {
    nextBody = dedupeSection(nextBody, section.heading);
  }

  if (nextBody === pr.body.trimEnd()) {
    console.log(`${colors.green}✓ PR body already contains required template sections.${colors.reset}`);
    return;
  }

  const tempPath = path.join(process.cwd(), '.tmp-pr-body.md');
  fs.writeFileSync(tempPath, `${nextBody}\n`);

  try {
    runGh(['pr', 'edit', String(pr.number), '--body-file', tempPath]);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }

  console.log(`${colors.green}✓ Updated PR body for ${pr.url}${colors.reset}`);
  if (missingBefore.length > 0) {
    console.log(`${colors.yellow}Added missing sections/items:${colors.reset}`);
    for (const item of missingBefore) {
      console.log(`  - ${item}`);
    }
  }
}

main();
