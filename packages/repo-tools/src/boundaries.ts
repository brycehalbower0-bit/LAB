#!/usr/bin/env node
/**
 * Module-boundary enforcement CLI (Phase 1 acceptance tooling).
 *
 *   boundaries check     — cruise the real workspace sources; exit 1 on any violation
 *   boundaries selftest  — prove the rules detect seeded violations in fixtures/
 *                          (a CI that cannot fail is not a check)
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './cruise.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

async function check(): Promise<number> {
  const roots = ['packages', 'apps']
    .map((dir) => join(repoRoot, dir))
    .filter((dir) => existsSync(dir));
  const violations = (await findViolations(roots)).filter(
    // The seeded-violation fixtures are supposed to violate the rules.
    (violation) => !violation.from.includes('fixtures/'),
  );
  if (violations.length > 0) {
    console.error(`✖ ${violations.length} module-boundary violation(s):`);
    for (const violation of violations) {
      console.error(`  [${violation.rule}] ${violation.from} → ${violation.to}`);
    }
    return 1;
  }
  console.log('✔ module boundaries clean');
  return 0;
}

async function selftest(): Promise<number> {
  const dirty = await findViolations([join(fixturesRoot, 'violation')]);
  const clean = await findViolations([join(fixturesRoot, 'clean')]);

  const rulesTriggered = new Set(dirty.map((violation) => violation.rule));
  const expected = ['no-circular', 'module-public-interface-only'];
  const missed = expected.filter((rule) => !rulesTriggered.has(rule));

  if (missed.length > 0) {
    console.error(`✖ selftest: seeded violations NOT detected for rule(s): ${missed.join(', ')}`);
    return 1;
  }
  if (clean.length > 0) {
    console.error('✖ selftest: clean fixture reported violations (rules over-match):');
    for (const violation of clean) {
      console.error(`  [${violation.rule}] ${violation.from} → ${violation.to}`);
    }
    return 1;
  }
  console.log(`✔ selftest: rules detect seeded violations (${expected.join(', ')})`);
  return 0;
}

const mode = process.argv[2];
const run = mode === 'check' ? check : mode === 'selftest' ? selftest : null;
if (run === null) {
  console.error('usage: boundaries <check|selftest>');
  process.exit(2);
}
run().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(2);
  },
);
