
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
module: TestComponent
problem_type: ui_bug
component: react_component
root_cause: logic_error
resolution_type: code_fix
symptoms:
  - "Component not rendering"
date: 2026-02-01
severity: high
---
Content
`;
    const filePath = createTestFile('ui-bugs', 'valid-doc.md', content);
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
module: TestComponent
problem_type: invalid_type
component: react_component
root_cause: logic_error
resolution_type: code_fix
symptoms:
  - "Test"
date: 2026-02-01
severity: high
---
`;
    const filePath = createTestFile('ui-bugs', 'invalid-cat.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid problem_type');
  });

  it('should fail for path mismatch', async () => {
    const content = `---
module: TestComponent
problem_type: api_error
component: react_component
root_cause: logic_error
resolution_type: code_fix
symptoms:
  - "Test"
date: 2026-02-01
severity: high
---
`;
    // Saved in ui-bugs, but problem_type is api_error (should be in api-errors dir)
    const filePath = createTestFile('ui-bugs', 'wrong-dir.md', content);
    const result = await validateFile(filePath, TEST_DIR);
    if (!result.valid) console.log('Error found:', result.error);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File location mismatch');
  });
});
