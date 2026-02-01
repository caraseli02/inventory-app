
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '../docs/TROUBLESHOOTING.md');
const outputDir = path.join(__dirname, '../docs/solutions');

// Mappings from Section Title to Category
const categoryMap = {
  'Black Screens / Failed API Calls': 'security', // CSP issues
  'Scanner Issues': 'frontend',
  'PWA & Service Worker Issues': 'infrastructure',
  'UI/UX Issues': 'ux',
  'Architecture Improvements': 'ignore',
  'Quick Reference: Deployment Checklist': 'ignore',
  'Common Debugging Commands': 'ignore',
  'Getting Help': 'ignore'
};

// Default values
const defaultSeverity = 'HIGH'; // P0 issues
const defaultStatus = 'resolved';
const defaultDate = '2026-02-01'; // Default date if not sound

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}

function parseMarkdown(content) {
  const issues = [];
  const lines = content.split('\n');

  let currentCategory = '';
  let currentIssue = null;
  let currentSection = ''; // 'symptoms', 'rootCause', etc.

  // Regex helpers
  const h2Regex = /^##\s+(.+)$/;
  const h3Regex = /^###\s+(?:Issue(?:\s+\d+)?:?)?\s*(.+)$/;
  const sectionRegex = /^\*\*([^\*]+):\*\*/; // **Symptoms:**

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for H2 (Category)
    const h2Match = line.match(h2Regex);
    if (h2Match) {
      const sectionName = h2Match[1].trim();
      currentCategory = categoryMap[sectionName] || 'other';
      continue;
    }

    if (currentCategory === 'ignore') continue;

    // Check for H3 (Issue)
    const h3Match = line.match(h3Regex);
    if (h3Match) {
      if (currentIssue) {
        issues.push(currentIssue);
      }

      const title = h3Match[1].trim();
      if (title.startsWith('Improvement:')) {
        currentIssue = null; // Skip improvements
        continue;
      }

      currentIssue = {
        title: title,
        category: currentCategory,
        severity: defaultSeverity,
        date: defaultDate,
        tags: [],
        module: 'Unknown',
        related_github_issue: null,
        status: defaultStatus,
        symptoms: [], // Array of strings
        commit: null,

        // Body sections
        problemDescription: '',
        symptomsText: '',
        rootCauseText: '',
        solutionText: '',
        filesChangedText: '',
        preventionText: ''
      };

      // Assume "Problem Description" is initially what follows the title until new section
      currentSection = 'problemDescription';
      continue;
    }

    if (!currentIssue) continue;

    // Check for inner sections
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].toLowerCase().trim();
      if (sectionName.includes('symptoms')) currentSection = 'symptoms';
      else if (sectionName.includes('root cause')) currentSection = 'rootCause';
      else if (sectionName.includes('solution')) currentSection = 'solution';
      else if (sectionName.includes('files changed')) currentSection = 'filesChanged';
      else if (sectionName.includes('commit')) {
        currentSection = 'commit';
        // Parse inline commit
        const sameLineContent = line.replace(sectionRegex, '').trim();
        const commitMatch = sameLineContent.match(/`([a-f0-9]+)`/);
        if (commitMatch) {
          currentIssue.commit = commitMatch[1];
        }
      }
      else if (sectionName.includes('prevention')) currentSection = 'prevention';
      else currentSection = ''; // unknown section
      continue;
    }

    // Capture Content
    if (currentSection === 'problemDescription') {
      if (line.length > 0) currentIssue.problemDescription += line + '\n';
    } else if (currentSection === 'symptoms') {
      if (line.startsWith('- ')) {
        currentIssue.symptoms.push(line.substring(2));
      } else if (line.length > 0) {
        currentIssue.symptomsText += line + '\n';
      }
    } else if (currentSection === 'rootCause') {
      currentIssue.rootCauseText += lines[i] + '\n'; // Preserve indentation for code blocks
    } else if (currentSection === 'solution') {
      currentIssue.solutionText += lines[i] + '\n';
    } else if (currentSection === 'filesChanged') {
      currentIssue.filesChangedText += line + '\n';
    } else if (currentSection === 'commit') {
      // Extract commit hash usually inline like `d39bb8f`
      const commitMatch = line.match(/`([a-f0-9]+)`/);
      if (commitMatch) {
        currentIssue.commit = commitMatch[1];
      }
    } else if (currentSection === 'prevention') {
      currentIssue.preventionText += line + '\n';
    }
  }

  if (currentIssue) {
    issues.push(currentIssue);
  }

  return issues;
}

function generateMarkdown(issue) {
  const frontmatter = {
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    date: issue.date,
    tags: issue.tags, // Populate manually or via keyword extraction?
    module: issue.module,
    related_github_issue: issue.related_github_issue,
    status: issue.status,
    symptoms: issue.symptoms,
    commit: issue.commit
  };

  const yamlStr = yaml.dump(frontmatter);

  return `---
${yamlStr}---

# Problem Description
${issue.title}

# Symptoms
${issue.symptoms.map(s => `*   ${s}`).join('\n')}
${issue.symptomsText}

# Root Cause Analysis
${issue.rootCauseText}

# Solution
${issue.solutionText}

# Files Changed
${issue.filesChangedText}

# Prevention
${issue.preventionText}
`;
}

function main() {
  const content = fs.readFileSync(inputFile, 'utf8');
  const issues = parseMarkdown(content);

  console.log(`Found ${issues.length} issues to migrate.`);

  // Dry run output
  if (process.argv.includes('--dry-run')) {
    issues.forEach(issue => {
      console.log('---');
      console.log(`Slug: ${slugify(issue.title)}`);
      console.log(`Category: ${issue.category}`);
      console.log(`Symptoms: ${issue.symptoms.length}`);
      console.log(`Commit: ${issue.commit}`);
    });
    return;
  }

  // Execute
  issues.forEach(issue => {
    const slug = slugify(issue.title);
    const filename = `${slug}.md`;
    const dir = path.join(outputDir, issue.category);

    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    const fileContent = generateMarkdown(issue);

    fs.writeFileSync(filepath, fileContent);
    console.log(`Created: ${filepath}`);
  });
}

main();
