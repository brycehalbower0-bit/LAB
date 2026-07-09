# 01 — System Architecture

**Status:** Normative · **Owner:** Chief Architect · **Last updated:** 2026-07-09

This document defines the shape of the system for its entire lifetime: the module
map, the boundaries between modules, the runtime topology at each growth stage, and
the rules for evolving the architecture without rewriting it.

---

## 1. Architectural Style

**Chronos is a modular monolith that is designed, from day one, to be split.**

Rationale (full reasoning in ADR-002):

- A small team building a deeply *relational* product (everything joins everything)
  is fastest and safest inside one process and one primary database.
- Premature microservices would multiply operational cost and — worse — encourage
  data duplication, which is fatal to a "single unified timeline."
- Therefore: **one deployable API application**, internally partitioned into
  strictly-bounded modules that communicate only through their public interfaces
  and domain events. Any module that later needs independent scaling (tiles, search,
  learning) can be extracted because the boundary already exists.

Hard rules that make the monolith splittable:

1. Modules **never** import another module's internals — only its published interface.
2. Modules **never** touch another module's database tables directly. Cross-module
   reads go through interfaces or read models; cross-module reactions go through
   domain events on the internal event bus.
3. Every module owns its schema (a named PostgreSQL schema), its migrations, its
   tests, and its docs.
4. The dependency graph between modules is acyclic and enforced by lint tooling.

## 2. The Module Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              CHRONOS PLATFORM                              │
│                                                                            │
│  DOMAIN LAYER (the knowledge)                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │  temporal-core│ │   gazetteer   │ │    polity     │ │     event     │   │
│  │ entities,     │ │ places, names,│ │ states,empires│ │ events, wars, │   │
│  │ assertions,   │ │ geometry hist,│ │ borders, govs,│ │ treaties,     │   │
│  │ valid-time,   │ │ location      │ │ leaders,      │ │ battles,      │   │
│  │ sources, conf.│ │ timelines     │ │ capitals      │ │ participants  │   │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────┬───────┘   │
│  ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐   │
│  │    person     │ │    culture    │ │   knowledge-  │ │   snapshot    │   │
│  │ people, roles,│ │ langs, relig.,│ │     graph     │ │ world-state @T│   │
│  │ offices,      │ │ currencies,   │ │ typed dated   │ │ materializer +│   │
│  │ lifespans     │ │ ideas, works  │ │ relationships │ │ cache         │   │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘   │
│                                                                            │
│  EXPERIENCE LAYER (the product)                                            │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │     atlas     │ │    search     │ │   learning    │ │   narrative   │   │
│  │ map layers,   │ │ entities, NL  │ │ quizzes, SRS, │ │ curated tours,│   │
│  │ styles, tile  │ │ questions,    │ │ challenges,   │ │ story maps,   │   │
│  │ orchestration │ │ time-aware    │ │ mastery       │ │ edu summaries │   │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘   │
│                                                                            │
│  PLATFORM LAYER (the machinery)                                            │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │   identity    │ │   curation    │ │  ai-assist    │ │   telemetry   │   │
│  │ users, auth,  │ │ revisions,    │ │ drafting,     │ │ product       │   │
│  │ roles, prefs  │ │ review queues,│ │ suggestion,   │ │ analytics,    │   │
│  │               │ │ diff/rollback │ │ consistency   │ │ audit log     │   │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Module responsibilities (one line each)

| Module | Owns | Never does |
|---|---|---|
| `temporal-core` | Entity registry, assertion model, HistoricalDate, sources/citations, confidence | Domain-specific logic |
| `gazetteer` | Places, historical names, geometry versions, location timelines | Political interpretation |
| `polity` | Polities (states/empires/colonies), border claims, governments, leaders-in-office, capitals, flags, currencies-in-use | Storing people (references `person`) |
| `event` | Events, wars, battles, treaties, causes/consequences, participants, importance scoring | Rendering |
| `person` | Persons, lifespans, roles, offices, affiliations | Office definitions (those live in `polity`) |
| `culture` | Languages, religions, currencies, inventions, works, ideas and their spread | Geometry storage (delegates to gazetteer) |
| `knowledge-graph` | Typed, dated edge store + traversal/relatedness API over all entities | Owning entity truth |
| `snapshot` | The World Snapshot read model: compute/cache "world at time T" | Being a source of truth |
| `atlas` | Layer definitions, cartographic styles, tile generation orchestration | Storing domain data |
| `search` | Indexing pipeline, entity/keyword/NL/time-aware queries | Being a source of truth |
| `learning` | Quiz item generation, SRS scheduling, challenges, mastery analytics, achievements | Authoring facts |
| `narrative` | Curated tours, story maps, educational summaries | Bypassing citation rules |
| `identity` | Accounts, OIDC auth, roles/permissions, preferences | Domain data |
| `curation` | Revisions, public contribution intake, review queues, reputation tiers, approval workflow, diff, rollback, bulk import | Direct writes without revision records |
| `ai-assist` | AI validation gate for proposals, LLM drafting/suggestions/consistency checks, always via `curation` | Writing canonical data |
| `telemetry` | Product analytics, learning telemetry, audit trail | Blocking user flows |

## 3. Runtime Topology

### Stage A — Foundation (Epochs 1–4)

```
   Clients:               ┌─────────────────────────────┐
   • Web (React +      ──►│  CDN / edge cache           │
     MapLibre GL JS)      └───────────┬─────────────────┘
   • iOS (SwiftUI +                   │
     MapLibre Native)                 │
        │                             │
        │ GraphQL/REST          tiles │ (pbf/png, immutable URLs)
        ▼                             ▼
 ┌──────────────────┐      ┌──────────────────┐
 │  chronos-api     │      │  chronos-tiles   │   (separate process from day 1:
 │  modular monolith│      │  vector tile     │    different perf profile,
 │  (Node/TS)       │      │  server (Martin) │    trivially stateless)
 └───────┬──────────┘      └────────┬─────────┘
         │                          │
         ▼                          ▼
 ┌─────────────────────────────────────────────┐   ┌──────────────────┐
 │  PostgreSQL 17 + PostGIS + pgvector         │   │  Object storage  │
 │  schemas: core, gazetteer, polity, event,   │   │  (S3): tilesets, │
 │  person, culture, graph, learning, identity,│   │  media, exports, │
 │  curation, telemetry                        │   │  dataset drops   │
 └─────────────────────────────────────────────┘   └──────────────────┘
         ▲                          ▲
         │                          │
 ┌───────┴──────────┐      ┌────────┴─────────┐
 │ chronos-workers  │      │ pipelines (Py)   │
 │ jobs: snapshot   │      │ ingestion of OSM,│
 │ builds, indexing,│      │ Wikidata, CShapes│
 │ tile invalidation│      │ etc → staging →  │
 │ SRS scheduling   │      │ curation import  │
 └──────────────────┘      └──────────────────┘
```

Also present from early on: **OpenSearch** (from the phase that introduces search),
**Redis** (queues + hot cache), and the **admin app** (served as part of the web
app behind role checks, later separable).

### Stage B — Growth (Epochs 5–7)

Same picture, plus: read replicas for PostgreSQL; snapshot cache promoted to its own
store; OpenSearch cluster; background AI-assist workers; optional extraction of
`search` and `learning` into services if load demands (the boundaries permit it —
the *decision* is deferred until data demands it).

### Stage C — Maturity (Epoch 8+)

Public API gateway with keys/quotas; multi-region read paths (DB replicas + CDN);
dedicated graph read store **only if** measured traversal load requires it (ADR-006).

## 4. The Two Data Planes

Chronos strictly separates:

- **The Canonical Plane** (system of record): normalized, revisioned, sourced
  assertions in PostgreSQL. Slow to write (editorial workflow), optimized for
  correctness, auditability, and flexible querying. Only `curation` writes here.
- **The Serving Plane** (read models): world snapshots, tilesets, search indexes,
  quiz item banks, relatedness caches. Disposable and rebuildable **from the
  canonical plane at any time**. Optimized for latency.

```
  editors / pipelines / AI-drafts
            │  (proposed revisions)
            ▼
     ┌────────────┐   approve    ┌──────────────────┐
     │  curation  │ ───────────► │  CANONICAL PLANE │──── audit, diff, rollback
     └────────────┘              │  (Postgres)      │
                                 └───────┬──────────┘
                                         │ domain events (entity.changed, …)
            ┌────────────────────────────┼─────────────────────────┐
            ▼                            ▼                         ▼
     ┌────────────┐              ┌──────────────┐          ┌──────────────┐
     │ snapshot   │              │ tile builds  │          │ search index │
     │ rebuilds   │              │ (atlas)      │          │ + quiz banks │
     └────────────┘              └──────────────┘          └──────────────┘
                       SERVING PLANE (rebuildable, cacheable)
```

**Invariant:** anything in the serving plane can be deleted and regenerated with no
loss of knowledge. This is what makes decades of schema evolution survivable.

## 5. Key Flows

### 5.1 "World at time T" (the core read)

1. Client sets timeline to T with viewport V and active layers L.
2. Map: client requests tiles `/tiles/{layer}/{time-bucket}/{z}/{x}/{y}.pbf`.
   Time is bucketed per layer resolution (e.g., political borders 1815–1914 bucket
   by year) so caching is effective; the tile server resolves bucket → prebuilt
   tileset or dynamic PostGIS query (`valid_start <= T < valid_end`).
3. Panel: client queries GraphQL `worldSnapshot(at: T, viewport: V)` which the
   `snapshot` module serves from cache (bucketed) or computes via temporal queries
   across polity/event/person/culture, then caches.
4. Every returned item carries entity IDs → click-through to pages; and citation
   refs → click-through to sources.

### 5.2 A contribution (the core write — staff and public alike, ADR-017)

1. Any contributor — community member, staff editor, ingestion pipeline, or AI
   draft — creates a **proposed revision**: a structured diff against canonical
   assertions, with sources attached. (Public users author these through guided
   editors: "add an event", "correct a date", "redraw this border segment".)
2. `curation` runs mechanical validation (schema, temporal consistency, geometry
   validity, citation presence, license gate), then `ai-assist` runs the **AI
   validation gate**: source verification, conflict/duplicate detection against
   canon, vandalism/spam scoring, and a structured review brief. Failing proposals
   bounce back to the contributor with specific reasons.
3. The proposal lands in a review queue routed by topic, contested-ness, and
   contributor reputation tier; a human reviewer (staff or promoted community
   reviewer) approves, requests changes, or rejects with comments.
4. On approval: canonical tables updated in a transaction; immutable revision
   record written (contributor credited); `entity.changed` event emitted.
5. Serving plane reacts: affected snapshot buckets invalidated, affected tiles
   re-enqueued, search documents re-indexed, dependent quiz items regenerated.
6. Rollback = applying the inverse revision through the same machinery.

### 5.3 Learning loop

Quiz items are *generated* from canonical assertions (templates + AI-assist with
review, see doc 07), stored with links back to their source assertions. When an
assertion changes, dependent items are flagged/regenerated. SRS scheduling runs in
workers; analytics land in `telemetry`.

## 6. Cross-Cutting Concerns

- **Identifiers:** every entity gets a stable, never-reused, prefixed public ID
  (`plc_`, `pol_`, `evt_`, `per_`, `src_`, …). External IDs (Wikidata QIDs, GeoNames,
  Pleiades) are stored as cross-references, never used as primary keys. (ADR-008)
- **Time:** all temporal logic uses the shared `historical-date` library
  (astronomical year numbering, calendar handling, precision, bounds — doc 03 §3).
  No raw `Date` for historical time, ever.
- **Events (technical):** internal domain events are transactional-outbox → Redis
  streams; consumers are idempotent. No event, no cache invalidation — so emitting
  events is enforced in the curation commit path, not left to callers.
- **Errors & observability:** structured logging with entity/revision correlation
  IDs; traces across api→db→workers; the audit log is append-only and immutable.
- **Security & privacy:** OIDC auth; RBAC roles (reader, learner, contributor,
  reviewer, editor-in-chief, admin); learning data is personal data — isolated,
  exportable, deletable (GDPR) without touching the knowledge base.
- **Client parity:** web and iOS consume identical contracts (GraphQL persisted
  queries, tile manifest, style spec). Anything computed in a client that both
  clients need (timeline bucketing display, HistoricalDate formatting) lives in a
  shared spec with per-platform implementations tested against shared golden
  vectors — never re-invented per client.
- **Internationalization:** all display strings and entity names are localizable
  from day one (names are *data* — multilingual, dated, sourced); UI chrome uses
  standard i18n tooling. English-first content, i18n-ready schema.
- **Testing doctrine:** see doc 08 §6. Every module ships unit + contract tests;
  temporal logic has property-based tests; ingestion has golden-file tests; the
  snapshot engine has regression fixtures ("Europe 1810", "Mediterranean 117", …).

## 7. Evolution Rules (how this architecture survives decades)

1. **Add modules, don't grow gods.** New capability = new module or explicit
   extension of one module's charter, recorded in this document.
2. **Extract only under measurement.** A module leaves the monolith only with a
   load/latency case, and extraction must not change its public contract.
3. **Read models are cattle.** Rebuild rather than migrate serving-plane stores.
4. **Canonical migrations are sacred.** Expand → backfill → contract; reversible;
   rehearsed on production-scale copies (Epoch 8 formalizes this).
5. **Every ADR is permanent.** Decisions are superseded, never deleted; ADR index in doc 02.
6. **Quarterly architecture review** (end of each epoch at minimum): re-read this
   document against reality; divergence is either fixed in code or amended here.
