
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOLUTIONS_DIR = path.resolve(__dirname, '../docs/solutions');
const SCHEMA_PATH = path.join(SOLUTIONS_DIR, 'schema.yaml');

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

// Load Schema
let SCHEMA;
try {
  SCHEMA = yaml.load(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (e) {
  console.error(`${colors.red}Failed to load schema from ${SCHEMA_PATH}: ${e.message}${colors.reset}`);
  process.exit(1);
}

const REQUIRED_FIELDS = Object.keys(SCHEMA.required_fields);
const OPTIONAL_FIELDS = Object.keys(SCHEMA.optional_fields);
const CATEGORY_MAPPING = SCHEMA.category_mapping;

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf-8' });
    return output.split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to get staged files:', error.message);
    process.exit(1);
  }
}

function getAllSolutionFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_archive' && entry.name !== 'patterns') walk(full);
      } else if (
        entry.name.endsWith('.md') &&
        entry.name !== 'README.md' &&
        entry.name !== '_template.md' &&
        entry.name !== 'MAINTENANCE.md'
      ) {
        results.push(path.relative(path.resolve(__dirname, '..'), full));
      }
    }
  }
  walk(SOLUTIONS_DIR);
  return results;
}

async function validateFile(filePath, projectRoot) {
  const fullPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) return { valid: true };

  const content = fs.readFileSync(fullPath, 'utf8');
  let frontmatter;

  // 1. Check YAML Syntax
  try {
    const parts = content.split('---');
    if (parts.length < 3) {
      throw new Error('Missing YAML frontmatter (must handle "---" delimiters)');
    }
    const yamlContent = parts[1];
    frontmatter = yaml.load(yamlContent);
  } catch (e) {
    return { valid: false, error: `Invalid YAML: ${e.message}` };
  }

  // 2. Validate Required Fields
  for (const field of REQUIRED_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === null || frontmatter[field] === '') {
      return { valid: false, error: `Missing required field: '${field}'` };
    }
  }

  // 3. Validate Enums
  // problem_type
  const validProblemTypes = SCHEMA.required_fields.problem_type.values;
  if (!validProblemTypes.includes(frontmatter.problem_type)) {
    return { valid: false, error: `Invalid problem_type '${frontmatter.problem_type}'. Allowed: ${validProblemTypes.join(', ')}` };
  }

  // component
  const validComponents = SCHEMA.required_fields.component.values;
  if (!validComponents.includes(frontmatter.component)) {
    return { valid: false, error: `Invalid component '${frontmatter.component}'. Allowed: ${validComponents.join(', ')}` };
  }

  // root_cause
  const validRootCauses = SCHEMA.required_fields.root_cause.values;
  if (!validRootCauses.includes(frontmatter.root_cause)) {
    return { valid: false, error: `Invalid root_cause '${frontmatter.root_cause}'. Allowed: ${validRootCauses.join(', ')}` };
  }

  // resolution_type
  const validResolutionTypes = SCHEMA.required_fields.resolution_type.values;
  if (!validResolutionTypes.includes(frontmatter.resolution_type)) {
    return { valid: false, error: `Invalid resolution_type '${frontmatter.resolution_type}'. Allowed: ${validResolutionTypes.join(', ')}` };
  }

  // severity
  const validSeverities = SCHEMA.required_fields.severity.values;
  if (!validSeverities.includes(frontmatter.severity)) {
    return { valid: false, error: `Invalid severity '${frontmatter.severity}'. Allowed: ${validSeverities.join(', ')}` };
  }

  // 4. Validate Date
  let dateValue = frontmatter.date;
  if (dateValue instanceof Date) {
    dateValue = dateValue.toISOString().split('T')[0];
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return { valid: false, error: `Invalid date format '${frontmatter.date}'. Use YYYY-MM-DD` };
  }

  // 5. Validate Symptoms Array
  if (!Array.isArray(frontmatter.symptoms) || frontmatter.symptoms.length < 1 || frontmatter.symptoms.length > 5) {
    return { valid: false, error: `symptoms must be an array with 1-5 items` };
  }

  // 6. Validate Tags (Optional)
  if (frontmatter.tags && (!Array.isArray(frontmatter.tags) || frontmatter.tags.length > 8)) {
    return { valid: false, error: `tags must be an array with max 8 items` };
  }

  // 7. Validate File Path
  const expectedSubDir = CATEGORY_MAPPING[frontmatter.problem_type];
  const expectedDir = path.join('docs', 'solutions', expectedSubDir);

  if (!filePath.includes(expectedDir)) {
    return { valid: false, error: `File location mismatch. problem_type '${frontmatter.problem_type}' should be in '${expectedDir}/', but file is in '${path.dirname(filePath)}'` };
  }

  // 8. Validate GitHub Issue (Optional)
  if (frontmatter.related_github_issue != null && frontmatter.related_github_issue !== '') {
    try {
      await execPromise(`gh issue view ${frontmatter.related_github_issue} --json state`, { timeout: 5000 });
    } catch (error) {
      const stderr = error.stderr || '';
      if (stderr.includes('Could not resolve to a Issue') || stderr.includes('Not Found')) {
        return { valid: false, error: `GitHub Issue #${frontmatter.related_github_issue} not found.` };
      }
      console.warn(`${colors.yellow}⚠ Warning: Could not validate GitHub Issue #${frontmatter.related_github_issue}: ${stderr.trim().split('\n')[0] || error.message}${colors.reset}`);
    }
  }

  return { valid: true };
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  const allMode = args.includes('--all');
  const filePaths = args.filter(a => !a.startsWith('--') && a.endsWith('.md'));

  let solutionFiles = [];

  if (filePaths.length > 0) {
    // Direct file path mode: validate specific files passed as arguments
    solutionFiles = filePaths;
  } else if (allMode) {
    // --all mode: validate every solution file (for CI)
    solutionFiles = getAllSolutionFiles();
  } else {
    // Default: staged files only (pre-commit hook)
    let files = [];
    try {
      files = getStagedFiles();
    } catch (error) {
      console.error('Failed to get staged files:', error.message);
      process.exit(1);
    }
    solutionFiles = files.filter(f =>
      f.startsWith('docs/solutions/') &&
      f.endsWith('.md') &&
      !f.endsWith('README.md') &&
      !f.endsWith('_template.md') &&
      !f.endsWith('MAINTENANCE.md') &&
      !f.includes('/patterns/') &&
      !f.includes('/_archive/')
    );
  }

  if (solutionFiles.length === 0) {
    console.log(`${colors.green}✔ No docs/solutions changes to validate.${colors.reset}`);
    process.exit(0);
  }

  console.log(`${colors.blue}Validating ${solutionFiles.length} solution document(s)...${colors.reset}`);

  let hasErrors = false;

  for (const file of solutionFiles) {
    const result = await validateFile(file, projectRoot);
    if (!result.valid) {
      console.error(`${colors.red}✘ ${file}: ${result.error}${colors.reset}`);
      hasErrors = true;
    } else {
      console.log(`${colors.green}✔ ${file}${colors.reset}`);
    }
  }

  if (hasErrors) {
    console.error(`\n${colors.red}Validation failed. Please fix the errors above.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.green}All validation checks passed!${colors.reset}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { validateFile };
