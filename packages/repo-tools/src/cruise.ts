import { cruise } from 'dependency-cruiser';
import { boundaryRules } from './rules.js';

export interface BoundaryViolation {
  rule: string;
  from: string;
  to: string;
}

/** Run the boundary rule set over the given roots and return violations. */
export async function findViolations(roots: string[]): Promise<BoundaryViolation[]> {
  const result = await cruise(roots, {
    ruleSet: boundaryRules,
    validate: true,
    doNotFollow: { path: 'node_modules' },
  });

  const output = result.output;
  if (typeof output === 'string') {
    throw new Error('expected structured cruise output, got string');
  }

  const violations: BoundaryViolation[] = [];
  for (const mod of output.modules) {
    for (const dep of mod.dependencies) {
      for (const rule of dep.rules ?? []) {
        violations.push({ rule: rule.name, from: mod.source, to: dep.resolved });
      }
    }
  }
  return violations;
}
