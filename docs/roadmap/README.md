# Roadmap — 100 Phases in 8 Epochs

**Status:** Normative · **Last updated:** 2026-07-09

The complete implementation plan. Work proceeds **one phase at a time, in order**
(charter rule); a phase is done only when its acceptance criteria, tests, docs,
changelog, and roadmap status are complete (Definition of Done, doc 08 §6).

Each phase entry specifies: objective, requirements, acceptance criteria,
database / API / frontend work, testing, documentation, dependencies, risks,
future considerations, and a time estimate.

## Estimating assumptions

Estimates assume a small core team (2–4 engineers plus heavy AI-assisted
development) working sequentially. At the median ~2 weeks/phase this plan spans
roughly **4–5 years** — consistent with the charter's horizon. Estimates are
planning signals, not promises; they are revised at every epoch review. If the
team grows, *phases stay sequential* but their internal work parallelizes.

## The Epochs

| Epoch | Phases | Theme | Exit state (what a user could do) |
|---|---|---|---|
| [1 — Foundations](epoch-1-foundations.md) | 1–12 | Repo, infra, temporal bedrock, curation kernel, app skeletons | Nothing public; the machine that builds the machine exists |
| [2 — Temporal & Geographic Core](epoch-2-temporal-geographic-core.md) | 13–25 | Gazetteer, modern baseline world, map+timeline instrument v1, snapshots v1 | Explore a complete, sourced map of *today*; open place pages; search |
| [3 — Political World Through Time](epoch-3-political-world-through-time.md) | 26–38 | Polities, borders through time (1815→present first), time-parameterized tiles | **Scrub the timeline and watch borders change**; country pages with leaders/capitals |
| [4 — Events, People & Knowledge Graph](epoch-4-events-people-knowledge-graph.md) | 39–51 | Events, wars, treaties, people, graph, real search, SSR pages | Click any year: wars, leaders, births, deaths; everything cross-linked |
| [5 — Depth: Cities, Culture & Layers](epoch-5-depth-cities-culture-layers.md) | 52–63 | City depth, deep-time coarse world, religion/language/trade/climate layers | Explore antiquity honestly; combine thematic layers; city dossiers |
| [6 — Learning Platform & iOS](epoch-6-learning-platform-and-ios.md) | 64–77 | Quiz engine, FSRS, challenges, mastery; the native iOS app | Learn with SRS on web; carry Chronos on iPhone, offline packs, widgets |
| [7 — Contribution, Curation & AI](epoch-7-contribution-curation-ai.md) | 78–89 | Admin tooling, AI validation gate, **public Wikipedia-style contribution** | Anyone proposes edits; AI gates; staff/community reviewers approve into canon |
| [8 — Scale, Openness & Launch](epoch-8-scale-openness-launch.md) | 90–100 | Performance, i18n, a11y, tours, educators, public API, launches | Public web launch + iOS App Store 1.0 + developer API |

## Dependency Spine

```
 E1 Foundations
  └─► E2 Geographic core ──► E3 Political time ──► E4 Events/people/graph
                                       │                   │
                                       ▼                   ▼
                              E5 Depth & layers ──► E6 Learning + iOS
                                                          │
                                                          ▼
                                            E7 Contribution & AI ──► E8 Launch
```

Cross-cutting invariants that gate everything downstream:

- Phase 5 (`historical-date`) blocks all temporal features.
- Phase 6 (assertion framework) blocks all knowledge ingestion.
- Phase 7 (curation kernel) blocks all writes, imports, and (later) public
  contribution — there is never a second write path.
- Phase 31 (time-parameterized tiles) is the product's technical heart; Epochs
  4–8 assume it.

## Status Legend & Tracking

Every phase carries a status in its epoch file: `PLANNED` → `IN PROGRESS` →
`DONE (date, rev)` (or `REVISED (link to amendment)`). The epoch review phases
(12, 25, 38, 51, 63, 77, 89, 100) re-audit architecture docs against reality and
may re-scope later epochs — re-scoping is recorded here, never done silently.

## Standing risks (watched at every epoch review)

1. **Historical border data is the scarcest resource.** Mitigations: license
   verification before planning (doc 04), curated-first strategy, community
   contribution (Epoch 7), honest coarse coverage over fake precision.
2. **Scope gravity.** The vision is enormous; the epoch reviews exist to cut and
   re-sequence rather than dilute the Definition of Done.
3. **Small team + decades horizon.** Everything disposable except canon (doc 01
   §4); boring technology (ADR-003); documentation as a first-class artifact.
4. **Review capacity once contribution opens.** AI gate + reputation tiers are
   designed for this; review latency is a tracked SLO from Phase 84.
