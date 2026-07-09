# Changelog

All notable changes to Project Chronos. Format: [Keep a Changelog](https://keepachangelog.com/);
dates are machine time (ISO). Blueprint-stage entries track documents; implementation-stage
entries will track phases.

## [Unreleased]

### Phase 1 — Project charter, monorepo & engineering standards (2026-07-09)

- Monorepo established: pnpm workspaces + turborepo; strict TypeScript base
  config; ESLint (flat config, type-checked) + Prettier; Node 22 pinned.
- Module-boundary enforcement shipped (`@chronos/repo-tools`): dependency-cruiser
  rules implementing doc 01 §1 (cross-module imports via `index` only; acyclic
  graph; no cross-package `src/` reach-ins), with seeded-violation fixtures and a
  self-test proving the rules can fail. Wired into `pnpm check`.
- CI (GitHub Actions): format check + `pnpm check` on every PR and push to main.
- Licenses added from canonical SPDX texts: AGPL-3.0-only (code, `LICENSE`),
  CC BY-SA 4.0 (content, `LICENSE-CONTENT`) per ADR-013.
- Contribution groundwork: CONTRIBUTING.md, engineering standards doc,
  CLA draft (pending legal review), CODEOWNERS, issue templates, PR template
  embedding the Definition of Done.
- Directory charters for `/apps`, `/pipelines`, `/infra`, `/data`, `/ios`.

## [0.1.0] — 2026-07-09 · The Blueprint

### Added

- Founding architectural blueprint (docs 00–08): vision & principles; system
  architecture (modular monolith, two data planes); technology decisions
  ADR-001…ADR-017; database & temporal model (assertion model, HistoricalDate,
  geometry versioning, bitemporal revisions); data acquisition & provenance
  strategy (source registry, pipeline architecture, licensing gates); API &
  integration design (GraphQL/tiles/curation contracts); frontend experience
  spec for **web and native iOS** clients; learning & knowledge systems spec
  (knowledge graph, quiz generation, FSRS spaced repetition); governance,
  quality & AI policy including the **public contribution workflow**
  (anyone proposes → AI validation gate → staff/community review → canon).
- 100-phase implementation roadmap in 8 epochs (docs/roadmap/).
- Glossary of binding vocabulary.
- This changelog.

### Decided

- Platforms: web (reference client) + native iOS (ADR-016); Android deferred.
- Contribution model: open, Wikipedia-style, AI-gated, human-approved (ADR-017).
- System of record: PostgreSQL + PostGIS + pgvector; serving plane fully
  rebuildable (ADR-003, doc 01 §4).
- Historical time: custom HistoricalDate spec over Julian Day ordinals (ADR-015).
