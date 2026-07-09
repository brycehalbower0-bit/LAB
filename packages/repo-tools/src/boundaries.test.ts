import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findViolations } from './cruise.js';

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

describe('module-boundary rules (doc 01 §1)', () => {
  it('detects seeded cross-module internal import and cycle', async () => {
    const violations = await findViolations([join(fixturesRoot, 'violation')]);
    const rules = new Set(violations.map((violation) => violation.rule));
    expect(rules).toContain('module-public-interface-only');
    expect(rules).toContain('no-circular');
  });

  it('passes a clean module tree (index-only cross-module imports)', async () => {
    const violations = await findViolations([join(fixturesRoot, 'clean')]);
    expect(violations).toEqual([]);
  });
});
