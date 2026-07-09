# PROJECT CHRONOS

**The Definitive Interactive History of Earth.**

Chronos is a long-horizon effort to build the single best way to learn geography,
history, politics, and the evolution of civilization: an application in which a user
can choose **any point in time** and explore Earth exactly as it existed then.

Drag the timeline. Borders shift. Empires rise and fall. Cities grow, are renamed,
are conquered, are rebuilt. Every place, person, event, treaty, river, religion,
language, and idea lives inside one unified, sourced, uncertainty-aware timeline —
rendered on an interactive map and connected through a knowledge graph.

> Google Earth × Wikipedia × Britannica × Civilization × GeoGuessr × Jeopardy ×
> a great historical atlas — as one coherent experience.

Chronos ships on two first-class platforms: **the web** and a **native iOS app**.
Both are thin clients over the same time-aware API and the same canonical
knowledge base — one brain, two faces.

---

## Status

**Current stage: Epoch 1 — Foundations (Phase 1 complete).**

The complete architectural blueprint and 100-phase roadmap govern all work.
Implementation proceeds **one phase at a time, in order, never skipping ahead**.
Phase status lives in [docs/roadmap/](docs/roadmap/README.md).

## Quickstart (development)

```bash
# Requirements: Node 22 (.nvmrc), pnpm 10 (corepack enable)
pnpm install
pnpm check     # lint + typecheck + tests + module-boundary checks (the merge bar)
pnpm format    # prettier
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/engineering-standards.md](docs/engineering-standards.md).

## The Blueprint

Read in order. Every document is normative unless marked exploratory.

| #   | Document                                                                    | Contents                                                                                     |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 00  | [Vision & Principles](docs/00-vision-and-principles.md)                     | Product vision, core philosophy, non-goals, definitions of success                           |
| 01  | [System Architecture](docs/01-system-architecture.md)                       | Module map, system diagrams, boundaries, runtime topology, evolution strategy                |
| 02  | [Technology Decisions](docs/02-technology-decisions.md)                     | ADR-style decisions: languages, databases, map stack, search, infra                          |
| 03  | [Database & Temporal Model](docs/03-database-and-temporal-model.md)         | The temporal core: entities, valid-time, uncertainty, geometry versioning, schema strategy   |
| 04  | [Data Acquisition & Provenance](docs/04-data-acquisition-and-provenance.md) | Source datasets, licensing, ingestion pipelines, citation & confidence model                 |
| 05  | [API & Integration Design](docs/05-api-and-integration-design.md)           | GraphQL/REST/tiles contracts, snapshot API, versioning, public API strategy                  |
| 06  | [Frontend Experience](docs/06-frontend-experience.md)                       | Map, timeline, layers, entity pages, search UX, design system                                |
| 07  | [Learning & Knowledge Systems](docs/07-learning-and-knowledge-systems.md)   | Knowledge graph, quizzes, spaced repetition, challenges, analytics                           |
| 08  | [Governance, Quality & AI Policy](docs/08-governance-quality-and-ai.md)     | Editorial workflow, admin tools, versioning/rollback, AI assistance rules, testing doctrine  |
| —   | [Roadmap](docs/roadmap/README.md)                                           | 100 phases in 8 epochs, with objectives, acceptance criteria, dependencies, risks, estimates |
| —   | [Changelog](CHANGELOG.md)                                                   | Every meaningful change to the project, forever                                              |
| —   | [Glossary](docs/GLOSSARY.md)                                                | Canonical vocabulary used across all documents and code                                      |

## Operating Rules (non-negotiable)

1. **Foundations first.** Architecture before features; correctness before speed.
2. **One phase at a time.** A phase ends only when its acceptance criteria, tests,
   documentation, changelog, and roadmap updates are complete.
3. **Everything sourced.** Every historical claim carries provenance and, where
   appropriate, confidence. Uncertainty is represented honestly, never hidden.
4. **Everything connected.** No entity exists in isolation; every record joins the
   unified timeline and knowledge graph.
5. **AI assists, never invents.** Generated content is always labeled, always
   reviewed, and never becomes canonical without human/editorial approval.
6. **Built to last decades.** Modular, documented, tested, versioned. Prefer
   maintainability over cleverness, clarity over brevity.

## Repository Layout (planned)

```
/docs          Blueprint, ADRs, roadmap, glossary        (exists now)
/packages      Shared libraries (temporal core, historical-date, geo, api-client)
/apps          Deployable applications (api, web, tiles, admin, workers)
/ios           Native iOS app (Swift/SwiftUI + MapLibre Native)
/pipelines     Data acquisition & ingestion (Python)
/infra         Infrastructure as code, CI/CD
/data          Small fixture/reference data only (large data lives in object storage)
```

## License & Data

Code license: to be finalized in Phase 1 (recommendation: AGPL-3.0 for the platform,
CC BY-SA for original curated content — see ADR-013). All ingested datasets are
tracked with their licenses in the [source registry](docs/04-data-acquisition-and-provenance.md).
