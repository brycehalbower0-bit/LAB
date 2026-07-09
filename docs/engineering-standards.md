# Engineering Standards

**Status:** Normative · **Established:** Phase 1 · **Last updated:** 2026-07-09

The concrete rules that operationalize the blueprint's doctrine (docs/01 §6–7,
docs/08 §6). CI enforces what can be enforced; review enforces the rest.

## Languages & toolchain

| Concern         | Standard                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Platform code   | TypeScript, strict mode (`tsconfig.base.json` — no opt-outs of `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Pipelines       | Python 3.11+, typed (mypy strict where practical), managed with uv                                                                 |
| iOS             | Swift 6, SwiftUI-first (from Phase 72)                                                                                             |
| Node            | v22 LTS line (`.nvmrc`); upgrades are deliberate, repo-wide, changelogged                                                          |
| Package manager | pnpm, version pinned via `packageManager`; lockfile committed; `--frozen-lockfile` in CI                                           |

## Repository rules

- **Monorepo layout is chartered.** Each top-level directory has a README
  charter; nothing lands outside its charter or ahead of its roadmap phase.
- **Module boundaries are law** (docs/01 §1): enforced by
  `pnpm check:boundaries`; the checker's self-test proves the rules can fail.
- **`pnpm check` green is the merge bar** — lint (zero warnings), typecheck,
  tests, boundaries, format.
- **No `any`,** no `@ts-ignore` without a linked issue, no `console.log` in
  library code (lint-enforced).
- **Dependencies are liabilities:** new runtime dependencies need a stated
  reason in the PR; anything security- or license-relevant is checked against
  ADR-013 compatibility (AGPL).

## Testing doctrine (docs/08 §6 applied)

- Every package ships unit tests; shared specs (historical-date, identifiers)
  ship **golden vectors** consumed by every language implementation.
- Property-based tests are the default for temporal/interval logic.
- Integration tests accompany every module that touches the database; the
  curation write-path always has end-to-end coverage.
- A check that cannot fail is not a check: enforcement tooling carries
  self-tests against seeded violations (see `packages/repo-tools`).

## Documentation rules

- Architecture deltas land in docs/00–08 **in the same PR** as the change.
- ADRs: append-only; superseding ADR links back to the superseded one.
- Every package/app/module has a README: charter, public interface, how to test.
- CHANGELOG.md is updated in every user- or contributor-visible PR.

## Git & review

- Trunk-based: short-lived branches → PR → squash or clean merge to `main`.
- CODEOWNERS review required; bedrock files (assertion model, HistoricalDate
  spec, ADR index) additionally require an ADR or dedicated phase.
- Commit conventions per CONTRIBUTING.md; CLA sign-off required.
- No force-pushes to `main`; history is permanent (matching the product's own
  revision philosophy).

## Security & secrets

- Secrets never in git (including test fixtures); `.env.example` documents shape.
- Least-privilege DB roles from Phase 3 onward; the curation-only write path is
  enforced at the database level, not by convention.
- Dependency audit runs in CI (advisories block merge at high severity).

## Decision log

Standards changes are PRs to this file with rationale; disputes escalate to an
ADR. This file never contradicts docs/00–08 — if it seems to, the blueprint wins
and this file gets fixed.
