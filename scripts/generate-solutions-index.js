
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOLUTIONS_DIR = path.resolve(__dirname, '../docs/solutions');
const README_PATH = path.join(SOLUTIONS_DIR, 'README.md');

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
    return {
      filePath,
      frontmatter,
      category: frontmatter.category || 'other'
    };
  } catch (e) {
    return null;
  }
}

function generateTable(docs) {
  const lines = [];
  lines.push('| Category | Solution | Severity | Date | Status |');
  lines.push('|----------|-----------|----------|------|--------|');

  docs.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return new Date(b.frontmatter.date) - new Date(a.frontmatter.date);
  });

  docs.forEach(doc => {
    const title = doc.frontmatter.title || path.basename(doc.filePath);
    const relPath = path.relative(SOLUTIONS_DIR, doc.filePath);
    const link = `[${title}](${relPath})`;
    const sev = doc.frontmatter.severity || '-';
    const date = doc.frontmatter.date ? (doc.frontmatter.date instanceof Date ? doc.frontmatter.date.toISOString().split('T')[0] : doc.frontmatter.date) : '-';
    const status = doc.frontmatter.status || '-';

    lines.push(`| ${doc.category} | ${link} | ${sev} | ${date} | ${status} |`);
  });

  return lines.join('\n');
}

function main() {
  const files = getAllFiles(SOLUTIONS_DIR);
  const docs = files.map(parseFile).filter(Boolean);

  const table = generateTable(docs);

  let readme = fs.readFileSync(README_PATH, 'utf8');
  const header = '## Solution Index';

  if (readme.includes(header)) {
    // Replace existing index
    const parts = readme.split(header);
    readme = parts[0] + header + '\n\n' + table + '\n';
    // ignoring what was after if any
  } else {
    // Append
    readme += '\n' + header + '\n\n' + table + '\n';
  }

  fs.writeFileSync(README_PATH, readme);
  console.log('Updated docs/solutions/README.md with index.');
}

main();
