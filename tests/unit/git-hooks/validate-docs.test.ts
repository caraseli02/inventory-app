
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { validateFile } from '../../../scripts/validate-docs.js';

// Mock fs and child_process if needed, but integration testing with real temporary files is better for reliability.
// We'll create a temp directory structure for tests.

const TEST_DIR = path.resolve(__dirname, 'temp-docs-test');
const SOLUTIONS_DIR = path.join(TEST_DIR, 'docs/solutions');

function createTestFile(category: string, filename: string, content: string) {
  const dir = path.join(SOLUTIONS_DIR, category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
  return path.join('docs/solutions', category, filename);
}

describe('validate-docs', () => {
  beforeAll(() => {
    if (!fs.existsSync(SOLUTIONS_DIR)) fs.mkdirSync(SOLUTIONS_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should pass for valid file', async () => {
    const content = `---
title: Valid Doc
category: frontend
severity: LOW
date: 2026-02-01
status: resolved
---
Content
`;
    const filePath = createTestFile('frontend', 'valid-doc.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    expect(result.valid).toBe(true);
  });

  it('should fail for missing frontmatter', async () => {
    const content = `Just markdown`;
    const filePath = createTestFile('frontend', 'missing-fm.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing YAML frontmatter');
  });

  it('should fail for missing required fields', async () => {
    const content = `---
title: Missing fields
---
`;
    const filePath = createTestFile('frontend', 'missing-fields.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing required field');
  });

  it('should fail for invalid category', async () => {
    const content = `---
title: Invalid Cat
category: invalid
severity: LOW
date: 2026-02-01
status: resolved
---
`;
    const filePath = createTestFile('frontend', 'invalid-cat.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid category');
  });

  it('should fail for path mismatch', async () => {
    const content = `---
title: Wrong Dir
category: backend
severity: LOW
date: 2026-02-01
status: resolved
---
`;
    // Saved in frontend, but category is backend
    const filePath = createTestFile('frontend', 'wrong-dir.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    if (!result.valid) console.log('Error found:', result.error);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File location mismatch');
  });
});
