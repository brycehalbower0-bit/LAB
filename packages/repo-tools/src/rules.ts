import type { IFlattenedRuleSet } from 'dependency-cruiser';

/**
 * Module-boundary rules implementing the hard rules of docs/01-system-architecture.md §1:
 *
 *   1. Modules never import another module's internals — only its published
 *      interface (`modules/<name>/index.ts`).
 *   4. The dependency graph between modules is acyclic.
 *
 * The rules are written against any tree containing a `modules/` directory, so
 * they apply unchanged to `apps/api/src/modules/*` when it arrives (Phase 9),
 * and are exercised today by the self-test fixtures.
 *
 * A third rule guards the workspace itself: packages must not deep-import
 * another package's `src/` — they must use the package's published exports.
 */
export const boundaryRules: IFlattenedRuleSet = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Doc 01 §1 rule 4: the module dependency graph is acyclic.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'module-public-interface-only',
      severity: 'error',
      comment:
        'Doc 01 §1 rule 1: cross-module imports must target the module public ' +
        'interface (modules/<name>/index.*), never its internals.',
      from: { path: '(^|/)modules/([^/]+)/' },
      to: {
        path: '(^|/)modules/[^/]+/',
        pathNot: ['(^|/)modules/$2/', '(^|/)modules/[^/]+/index\\.(js|mjs|cjs|ts|mts|cts)$'],
      },
    },
    {
      name: 'no-cross-package-internals',
      severity: 'error',
      comment:
        'Workspace packages must consume each other through published exports, ' +
        "never by reaching into another package's src/.",
      from: { path: '^packages/([^/]+)/' },
      to: {
        path: '^packages/[^/]+/src/',
        pathNot: ['^packages/$1/'],
      },
    },
  ],
};
