# 07 — Learning & Knowledge Systems

**Status:** Normative · **Owner:** Educational Designer / Technical Lead · **Last updated:** 2026-07-09

The learning platform and the knowledge graph are two views of the same principle:
knowledge that connects is knowledge that sticks. This document specifies the
knowledge-graph semantics and the complete learning system built on top of it.

---

## 1. Knowledge Graph Semantics

Storage is defined in doc 03 §6; this section defines meaning and use.

### 1.1 Relationship vocabulary (governed)

Initial controlled vocabulary (extension requires a curation-approved vocabulary
revision — ADR-017 path):

| Family | Relations (dated, directed, sourced) |
|---|---|
| Structure | `part_of`, `member_of`, `successor_of`, `predecessor_of`, `vassal_of`, `colony_of` |
| Governance | `ruled` (person→polity, office-qualified), `capital_of` (place→polity) |
| Conflict | `fought_in`, `at_war_with`, `allied_with`, `besieged`, `won`, `lost` |
| Diplomacy | `signed` (polity/person→treaty), `party_to`, `ceded` / `acquired` (territory-qualified) |
| Causality | `caused`, `contributed_to`, `resulted_from`, `enabled` — always with rationale + sources; causality claims default `interpretation='disputed'` unless strongly sourced |
| Space | `located_in`, `flows_through`, `borders` |
| Culture & ideas | `influenced`, `practiced_in`, `spoken_in`, `spread_to`, `founded`, `authored`, `invented`, `discovered` |
| People | `parent_of`, `married_to`, `taught`, `served_under` |

### 1.2 Graph products (read models)

- **Neighborhood API:** the dated, typed 1–2-hop context that entity pages render.
- **Relatedness scores:** precomputed (edge-type-weighted + embedding similarity)
  for "related knowledge" rails and quiz distractor selection.
- **Paths & chains:** cause→consequence chains for event pages; succession chains
  for polities/offices; these power the "everything is connected" browsing feel.
- **Importance scores:** per entity/event — computed from graph centrality,
  source density, and editorial weighting; drives map label priority, snapshot
  inclusion cutoffs, search ranking, and quiz frequency. Recomputed in workers;
  editorially overridable; formula versioned.

## 2. Quiz Item System

### 2.1 Item = generated from assertions, always

A quiz item stores: prompt template + parameters, answer(s), distractor strategy,
`derived_from` assertion IDs, difficulty estimate, media/map spec, and licensing
of any media. When a source assertion changes or is retired, dependent items are
auto-flagged for regeneration — learning content can never silently contradict
the encyclopedia (doc 00 §4).

### 2.2 Item families

| Family | Examples |
|---|---|
| Locate | Click country/city/river/mountain on the map **at time T**; GeoGuessr-style "where is this historical view?" |
| Identify | Flag→country (era-aware: flags change!), capital→polity, leader portrait→name |
| Temporal | Order events; place event on timeline; "which came first?"; duration estimates |
| Relational | Who fought whom; which treaty ended which war; successor states |
| Quantitative | Population/area comparisons at T (ranges respected — no false-precision answers) |
| Cartographic | Which border is correct for year Y (drawn options); match map→era |
| Narrative | Cause/consequence multiple choice (only from strongly-sourced causal edges) |

Generation pipeline: template engine over canonical queries → AI-assist may
propose phrasing variants and plausible distractors → **all items pass the same
curation review as facts before entering the public bank** (auto-generated items
from high-confidence templates may ship as `provisional` in practice modes only,
clearly labeled, per ADR-014's labeling rule).

### 2.3 Difficulty & adaptivity

Item difficulty is estimated from response data (Elo-style item/learner ratings —
upgrade path to IRT 2PL when data volume supports it). Sessions target ~70–80%
success; adaptive selection balances: due reviews, weak-area coverage, novelty,
and learner-chosen scope (region/era/topic).

## 3. Spaced Repetition (SRS)

- Scheduler: **FSRS** (modern, open, parameterized) over item-level memory states;
  per-learner parameters fitted from review history in workers.
- Review queue unifies all item families; map-native items are first-class reviews.
- Anti-burnout: daily caps, load smoothing, vacation mode, "catch-up" flows.
- Offline (iOS): reviews computed against synced state; attempts queue and merge
  (last-write-wins per attempt, server re-schedules on sync).
- Learning state is personal data: isolated, exportable, erasable (doc 03 §9).

## 4. Modes & Motivation

- **Daily challenge:** same 10 items worldwide per day (seeded from importance +
  variety constraints), shareable result grid, streaks.
- **Weekly deep-dive:** one region×era, mixing exploration prompts and quizzes.
- **Random challenge / endless:** filtered free-play.
- **Custom study sets:** any page, viewport, search result, or tour → a set;
  shareable/assignable (educator flows); sets subscribe to canon (they update when
  facts do, with change notices).
- **Achievements:** exploration ("visited every century"), mastery ("Iberia:
  gold"), contribution ("first approved edit") — never engagement-bait (no
  loss-aversion dark patterns; doc 00 non-goals).
- **Mastery model:** per (region × era × topic) cell: coverage × retention
  (from SRS memory state) × recency → 0–100 mastery with decay; the heat-grid in
  doc 06 §5 renders these cells; analytics show trends and forecasts.

## 5. Learning Analytics & Efficacy

Telemetry captures attempts, latencies, review outcomes (privacy-scoped, doc 08
§5). We publish our retention metrics methodology; A/B changes to scheduling or
item generation require pre-registered metrics (doc 00 §9 "learning efficacy").
Educator dashboards (class progress, common misconceptions) build on the same
events in a later epoch.

## 6. Narrative Layer (tours & story maps)

Curated sequences — "The Fall of Rome in 12 stops", "Silk Road journey" — each
stop = (T, viewport, layers, focused entities, narrative text with citations).
Tours are curation-reviewed content, quizzable like everything else, and the
seed for classroom curricula. Community tour authoring follows the same
contribution pipeline once public contribution matures.
