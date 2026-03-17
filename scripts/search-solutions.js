
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOLUTIONS_DIR = path.resolve(__dirname, '../docs/solutions');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      // Skip archive and patterns directories
      if (file === '_archive' || file === 'patterns') {
        return;
      }
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.md') && file !== 'README.md' && file !== '_template.md' && !file.includes('MAINTENANCE.md')) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });
  return arrayOfFiles;
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parts = content.split('---');
  if (parts.length < 3) return null;

  try {
    const frontmatter = yaml.load(parts[1]);
    const body = parts.slice(2).join('---');
    return {
      filePath,
      frontmatter,
      body,
      filename: path.basename(filePath)
    };
  } catch (e) {
    return null;
  }
}

function calculateScore(doc, query) {
  const qTerms = query.toLowerCase().split(/\s+/);
  let score = 0;

  const moduleName = (doc.frontmatter.module || '').toLowerCase();
  const problemType = (doc.frontmatter.problem_type || '').toLowerCase();
  const component = (doc.frontmatter.component || '').toLowerCase();
  const rootCause = (doc.frontmatter.root_cause || '').toLowerCase();
  const body = doc.body.toLowerCase();
  const tags = (doc.frontmatter.tags || []).map(t => t.toLowerCase());
  const filename = doc.filename.toLowerCase();

  qTerms.forEach(term => {
    // Exact tag match (+10)
    if (tags.includes(term)) score += 10;

    // Module name match (+8)
    if (moduleName.includes(term)) score += 8;

    // Filename match (+6) — filenames encode module+date and are well-structured
    if (filename.includes(term)) score += 6;

    // Component match (+5)
    if (component === term || component.includes(term)) score += 5;

    // Problem type match (+5)
    if (problemType === term || problemType.includes(term)) score += 5;

    // Root cause match (+5)
    if (rootCause === term || rootCause.includes(term)) score += 5;

    // Keyword in body (+3 per occurrence, capped at 15 to prevent long-doc inflation)
    const matches = (body.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += Math.min(matches * 3, 15);

    // Severity
    if (term === (doc.frontmatter.severity || '').toLowerCase()) score += 3;
  });

  // Recency bonus applied once per document, not per query term
  if (doc.frontmatter.date) {
    const date = new Date(doc.frontmatter.date);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (date > sixMonthsAgo) score += 2;
  }

  return score;
}

function main() {
  const args = process.argv.slice(2);
  let query = '';

  // Handle --query flag or just raw args
  if (args.includes('--query')) {
    const idx = args.indexOf('--query');
    if (idx + 1 < args.length) query = args[idx + 1];
  } else {
    query = args.join(' ');
  }

  if (!query) {
    console.error('Usage: node search-solutions.js --query "search terms"');
    process.exit(1);
  }

  const files = getAllFiles(SOLUTIONS_DIR);
  const docs = files.map(parseFile).filter(Boolean);

  const results = docs.map(doc => ({
    doc,
    score: calculateScore(doc, query)
  }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3

  if (results.length === 0) {
    console.log("No solutions found.");
    return;
  }

  const output = results.map(r => ({
    score: r.score,
    module: r.doc.frontmatter.module,
    path: path.relative(path.resolve(__dirname, '..'), r.doc.filePath),
    problem_type: r.doc.frontmatter.problem_type,
    component: r.doc.frontmatter.component,
    severity: r.doc.frontmatter.severity,
    summary: r.doc.body.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('```'))
      .slice(0, 2).join(' ').replace(/[*_]/g, '').trim()
  }));

  console.log(JSON.stringify(output, null, 2));
}

main();
