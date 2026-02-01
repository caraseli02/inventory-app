
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync, exec } from 'child_process';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOLUTIONS_DIR = path.resolve(__dirname, '../docs/solutions');
const VALID_CATEGORIES = ['frontend', 'backend', 'infrastructure', 'security', 'ux'];
const VALID_SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'];

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf-8' });
    return output.split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to get staged files:', error.message);
    process.exit(1);
  }
}

async function validateFile(filePath, projectRoot) {
  const fullPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) return { valid: true }; // Deleted file? Ignored by diff-filter but just in case

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
  const requiredFields = ['title', 'category', 'severity', 'date', 'status'];
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      return { valid: false, error: `Missing required field: '${field}'` };
    }
  }

  // 3. Validate Enums
  if (!VALID_CATEGORIES.includes(frontmatter.category)) {
    return { valid: false, error: `Invalid category '${frontmatter.category}'. Allowed: ${VALID_CATEGORIES.join(', ')}` };
  }
  if (!VALID_SEVERITIES.includes(frontmatter.severity)) {
    return { valid: false, error: `Invalid severity '${frontmatter.severity}'. Allowed: ${VALID_SEVERITIES.join(', ')}` };
  }

  // 4. Validate Date
  let dateValue = frontmatter.date;
  if (dateValue instanceof Date) {
    dateValue = dateValue.toISOString().split('T')[0];
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return { valid: false, error: `Invalid date format '${frontmatter.date}'. Use YYYY-MM-DD` };
  }

  // 5. Validate File Path
  const relativeDir = path.dirname(filePath); // docs/solutions/frontend
  const expectedDir = path.join('docs', 'solutions', frontmatter.category);

  // Checking if filePath starts with expectedDir might be safer
  if (!filePath.includes(expectedDir)) {
    return { valid: false, error: `File location mismatch. Category '${frontmatter.category}' should be in '${expectedDir}/', but file is in '${relativeDir}'` };
  }

  // 6. Validate GitHub Issue
  if (frontmatter.related_github_issue) {
    try {
      // shorter timeout to avoid hanging if network sucks
      await execPromise(`gh issue view ${frontmatter.related_github_issue} --json state`, { timeout: 5000 });
    } catch (error) {
      const stderr = error.stderr || '';
      if (stderr.includes('Could not resolve to a Issue') || stderr.includes('Not Found')) {
        return { valid: false, error: `GitHub Issue #${frontmatter.related_github_issue} not found.` };
      }
      // Other errors (auth, network) -> Warning only
      console.warn(`${colors.yellow}⚠ Warning: Could not validate GitHub Issue #${frontmatter.related_github_issue}: ${stderr.trim().split('\n')[0] || error.message}${colors.reset}`);
    }
  }

  return { valid: true };
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const files = getStagedFiles();

  // Filter for docs/solutions/
  const solutionFiles = files.filter(f => f.startsWith('docs/solutions/') && f.endsWith('.md') && !f.endsWith('README.md') && !f.endsWith('_template.md'));

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

export { validateFile };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
