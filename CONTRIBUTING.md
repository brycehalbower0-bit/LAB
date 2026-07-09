# Contributing to Project Chronos

Thank you for wanting to help build the definitive interactive history of Earth.

> **Note on stages.** Until the public contribution system ships (roadmap Epoch 7),
> "contributing" means contributing to the _platform_ — code, docs, data
> pipelines — via this repository. Contributing historical _content_ will get its
> own in-product workflow (docs/08 §2) with AI validation and editorial review.

## Ground rules

1. **The blueprint governs.** Read `docs/00`–`08` before proposing structural
   changes. Consequential technology changes require a new ADR in
   `docs/02-technology-decisions.md` (ADRs are superseded, never edited).
2. **One phase at a time.** Implementation follows `docs/roadmap/` in order.
   PRs that jump ahead of the active phase will be parked, not rejected — the
   sequence is the project's control system.
3. **Definition of Done** (docs/08 §6) applies to every PR: acceptance criteria,
   tests, docs, changelog, roadmap status. The PR template walks you through it.
4. **Licensing.** Code is AGPL-3.0-only (`LICENSE`); original content is
   CC BY-SA 4.0 (`LICENSE-CONTENT`). By contributing you agree to the
   [Contributor License Agreement](CLA.md).

## Development setup

```bash
# Requirements: Node 22 (see .nvmrc), pnpm 10 (corepack enable)
pnpm install
pnpm check     # lint + typecheck + tests + module-boundary checks
pnpm format    # prettier
```

`pnpm check` must be green before review. CI runs exactly the same command.

## Commit conventions

- Present-tense imperative subject lines, ≤72 chars: `Add gazetteer place tables`.
- Body explains _why_ when it isn't obvious from the diff.
- Reference the roadmap phase where applicable: `(Phase 13)`.
- One logical change per commit; no drive-by refactors mixed into feature commits.

## Module boundaries

The architecture's hard rules (docs/01 §1) are enforced by
`pnpm check:boundaries` (dependency-cruiser under `packages/repo-tools`):
cross-module imports must go through `modules/<name>/index.ts`, the module graph
must be acyclic, and packages must not reach into another package's `src/`.
If a boundary blocks you, the answer is a better public interface — not an
exception to the rule.

## Questions & decisions

Ambiguity is never resolved by guessing (docs/00 §10). Open a discussion or an
issue; decisions that stick get recorded (ADR for technology, blueprint
amendment for architecture, review notes otherwise).
