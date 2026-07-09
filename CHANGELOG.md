# Changelog

All notable changes to Project Chronos. Format: [Keep a Changelog](https://keepachangelog.com/);
dates are machine time (ISO). Blueprint-stage entries track documents; implementation-stage
entries will track phases.

## [Unreleased]

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
