
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
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.md') && file !== 'README.md' && file !== '_template.md') {
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

  const title = (doc.frontmatter.title || '').toLowerCase();
  const category = (doc.frontmatter.category || '').toLowerCase();
  const body = doc.body.toLowerCase();
  const tags = (doc.frontmatter.tags || []).map(t => t.toLowerCase());

  qTerms.forEach(term => {
    // Exact tag match (+10)
    if (tags.includes(term)) score += 10;

    // Category match (+5)
    if (category === term) score += 5;

    // Keyword in title (+8)
    if (title.includes(term)) score += 8;

    // Keyword in body (+3 per occurrence, max capped maybe?)
    // Simple occurrence count is expensive, just check inclusion for now or regex count
    const matches = (body.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += matches * 3;

    // Recent date
    if (doc.frontmatter.date) {
      const date = new Date(doc.frontmatter.date);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (date > sixMonthsAgo) score += 2;
    }

    // Severity
    if (term === (doc.frontmatter.severity || '').toLowerCase()) score += 3;
  });

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

  // Output JSON for easy parsing by agent? Or human readable?
  // Plan says "Return top 3 matches with summaries".
  // I'll output JSON.

  const output = results.map(r => ({
    score: r.score,
    title: r.doc.frontmatter.title,
    path: path.relative(path.resolve(__dirname, '..'), r.doc.filePath),
    category: r.doc.frontmatter.category,
    severity: r.doc.frontmatter.severity,
    summary: r.doc.body.trim().split('\n').slice(0, 2).join(' ').replace(/[#*]/g, '').trim()
  }));

  console.log(JSON.stringify(output, null, 2));
}

main();
