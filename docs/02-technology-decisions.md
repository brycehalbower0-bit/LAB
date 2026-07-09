# 02 — Technology Decisions (ADR Index)

**Status:** Normative · **Owner:** Chief Architect · **Last updated:** 2026-07-09

Every consequential technology choice is recorded here as a compact Architecture
Decision Record. ADRs are immutable once accepted; changes create a superseding ADR.
Format: Context → Decision → Rationale → Consequences/Revisit-when.

---

## ADR-001 · Primary language: TypeScript for platform, Python for data pipelines

**Context.** One team must build API, web frontend, admin tooling, and heavy
geo/data ingestion.

**Decision.** TypeScript everywhere in the product (API, web, workers, shared
libraries) on Node.js. Python exclusively for data acquisition/ETL pipelines
(`/pipelines`), where GeoPandas/Shapely/GDAL and the scientific ecosystem are
unmatched.

**Rationale.** One product language maximizes shared types (entity models, API
contracts, historical-date logic compiled once, used on both client and server).
Python's geospatial ETL ecosystem would be painful to replicate in Node.

**Consequences.** The `historical-date` and ID conventions must be specified
language-neutrally (JSON Schema + spec doc) with a small Python mirror
implementation, tested against the same golden test vectors as the TS one.

## ADR-002 · Modular monolith, pre-partitioned for extraction

**Context.** Microservices vs monolith for a deeply relational domain, small team,
decades horizon.

**Decision.** Single deployable API (NestJS) with strictly bounded internal modules
(doc 01 §1–2); tiles server separate from day one; workers as a second process
sharing module code. Extraction only under measured need.

**Rationale.** Cross-entity joins are the product. One database with real foreign
keys and transactions eliminates the classes of consistency bugs that would destroy
a "unified timeline." NestJS chosen for enforced module structure, DI, and
first-class GraphQL support.

**Revisit when.** Any module's load profile diverges by >1 order of magnitude, or
team size exceeds ~15 engineers.

## ADR-003 · System of record: PostgreSQL + PostGIS (+ pgvector)

**Context.** Need relational integrity, temporal queries, geospatial queries,
full-text and vector search, JSON flexibility, millions→hundreds-of-millions rows.

**Decision.** PostgreSQL (current LTS-ish major, 17 at time of writing) with
PostGIS for all geometry, `pgvector` for embeddings, one database with per-module
schemas. Range types (`int8range` over serialized HistoricalDate ordinals) + GiST
indexes for valid-time queries.

**Rationale.** Postgres is the only store that covers relational + temporal +
spatial + JSON + vector credibly for decades, with a migration story and an
operational ecosystem to match. Everything else in the serving plane is disposable,
so the system of record must be the most boring, durable choice available.

**Consequences.** We accept writing our own thin temporal-versioning layer
(assertions + revisions) instead of adopting a niche bitemporal DB (XTDB, etc.) —
evaluated and rejected for ecosystem risk over a decades horizon.

## ADR-004 · Geometry versioning: PostGIS features with valid-time, tiled via MVT

**Context.** Borders and places change through time; we must serve "geometry at T"
fast at every zoom.

**Decision.** Canonical geometries stored as PostGIS features carrying
`valid_time` ranges, certainty class, and provenance (doc 03 §5). Serving via
Mapbox Vector Tiles: prebuilt tilesets (tippecanoe/planetiler) for stable historical
buckets + dynamic `ST_AsMVT` from the tile server (Martin) for low-traffic or
freshly-edited periods. Time is bucketed per layer to keep the cache space finite.

**Rationale.** Vector tiles give client-side styling (hover, selection, per-polity
coloring, uncertainty rendering) and small payloads; the hybrid prebuilt/dynamic
split matches the edit pattern (old periods stable, active periods churn).

**Revisit when.** 3D/globe terrain or raster time-series layers (climate) need
their own pipeline — they will be additive (raster tiles/COG), not a replacement.

## ADR-005 · Map rendering: MapLibre GL JS + deck.gl overlays

**Decision.** MapLibre GL JS (open-source, vector-tile native, globe projection
support) as the base map engine; deck.gl for data-dense animated overlays
(migrations, trade flows, battle animations). No proprietary map SDKs.

**Rationale.** Open source is non-negotiable for a decades project (no license
rug-pulls); MapLibre has the strongest OSS momentum; deck.gl composes with it and
covers the "world feels alive" animation ambitions.

## ADR-006 · Knowledge graph: in PostgreSQL, not a dedicated graph database

**Context.** Everything connects to everything; tempting to reach for Neo4j.

**Decision.** Typed, dated edges live in a Postgres `graph.edge` table (doc 03 §6);
traversals via recursive CTEs and precomputed relatedness read models. A dedicated
graph store may be added later _as a serving-plane read model only_.

**Rationale.** Our graph queries are shallow (1–3 hops, heavily filtered by time
and type) — Postgres handles these well. A second system of record would split the
source of truth, the cardinal sin (doc 01 §4).

**Revisit when.** Measured need for deep traversals (path-finding, centrality at
scale) that CTEs + read models cannot serve.

## ADR-007 · Search: OpenSearch for text/NL, pgvector for semantic, hybrid ranking

**Decision.** OpenSearch as the search serving store (entities, pages, events, with
time-aware fields and alternate names/spellings); embeddings in pgvector for
semantic/NL question retrieval; hybrid retrieval merged in the `search` module.
Postgres FTS is used only as the interim engine until the search phases land.

**Rationale.** Historical search demands: fuzzy matching across transliterations
("Constantinople/Byzantium/İstanbul"), temporal filtering ("France in 1400"), and
natural-language questions. That combination needs a real search engine plus
embeddings; OpenSearch keeps us fully open source.

## ADR-008 · Identifiers: internal ULIDs with typed public prefixes; external IDs as cross-references

**Decision.** Primary keys are ULIDs; public IDs are prefixed (`pol_01H…`,
`evt_01H…`). Wikidata QIDs, GeoNames, Pleiades, WHG, OSM IDs are stored in an
`external_id` cross-reference table (many per entity, dated, sourced). IDs are
never reused, renames never change IDs, merges leave permanent redirects.

**Rationale.** Decades of URL stability and citability; external vocabularies
change and must not be load-bearing.

## ADR-009 · API: GraphQL for the knowledge graph, REST for tiles/binary/webhooks, one gateway

**Decision.** GraphQL (code-first via NestJS) as the primary read API — the data is
a graph and clients (map panel, pages, admin) need wildly different shapes. REST
for tiles, media, exports, health, and the future public API v1 (doc 05). Mutations
exist only for identity/learning/curation workflows — never raw fact writes.

**Rationale.** GraphQL's shape-flexibility fits entity pages and snapshots;
persisted queries + response caching mitigate its caching weaknesses; tiles must be
plain cacheable HTTP.

## ADR-010 · Web frontend: React + Vite + TanStack (Router/Query), Zustand for map/timeline state

**Decision.** SPA-first web app (the product is an app, not a document site) with
server-rendered public entity pages for SEO/sharing added in a later phase via a
thin SSR layer over the same GraphQL API. TypeScript throughout; design system with
Radix primitives + vanilla-extract (or CSS-modules) tokens; Storybook for the
component library. The web app is the **reference client**: every capability ships
here first, and admin/curation tooling is web-only.

**Rationale.** The map/timeline is a stateful instrument, best as SPA;
encyclopedia pages are share/SEO-critical, best served rendered — the split
respects both without two frontends.

## ADR-011 · Async infrastructure: Redis (BullMQ) + transactional outbox

**Decision.** Domain events written to an outbox table in the same transaction as
canonical writes; a relay publishes to Redis streams/BullMQ queues consumed by
workers (snapshot rebuilds, tile builds, indexing, SRS, AI-assist). Kafka is
explicitly deferred.

**Rationale.** Exactly-once effect via outbox + idempotent consumers, with an
operational footprint a small team can carry. Kafka only if event volume demands it.

## ADR-012 · Deployment: containers + IaC from day one, provider-portable

**Decision.** Docker images; Terraform/OpenTofu IaC; deploy initially to a single
managed platform (managed Postgres + container runtime + S3-compatible storage +
CDN); CI/CD via GitHub Actions. Kubernetes only when service count/scale warrants.

**Rationale.** Portability guards the decades horizon; managed services guard the
team's time now.

## ADR-013 · Licensing: AGPL-3.0 code; CC BY-SA 4.0 original content; per-source data licenses honored

**Decision.** Platform code AGPL-3.0 (protects openness of derivatives of a
knowledge commons); original curated content CC BY-SA 4.0 (Wikipedia-compatible);
every ingested dataset's license tracked in the source registry with a compliance
gate in ingestion (doc 04 §4). ODbL data (OSM) kept in attribution-safe layers.

**Revisit when.** Sustainability model is finalized (Epoch 8); dual-licensing
remains possible while contributor CLAs are collected from Phase 1.

## ADR-014 · AI assistance: provider-abstracted, human-gated, never canonical

**Decision.** All LLM usage goes through an internal `ai-assist` service layer with
a provider abstraction (Anthropic API first). Outputs are always: (a) labeled
generated, (b) routed into curation review queues, (c) grounded with retrieved
canonical assertions and sources, (d) logged with prompt+model+version for audit.
Model choice per task is configuration, not code.

**Rationale.** Doc 00 §3/§6 commitments; provider abstraction because model
landscapes shift far faster than this project's lifetime.

## ADR-015 · Historical time representation: custom HistoricalDate over astronomical Julian Day ordinals

**Decision.** All historical time is represented by the shared `historical-date`
spec: an ordinal (Julian Day Number–based int64) plus precision
(day/month/year/decade/century/millennium/era) plus optional earliest/latest
bounds; astronomical year numbering internally (1 BCE = year 0); calendar of
_record_ (Julian/Gregorian/other) stored alongside for display/scholarship;
BCE/CE rendering handled at the display layer. Native `timestamp` types are used
only for machine/system time (audit logs, jobs), never for historical claims.

**Rationale.** Unix epochs and SQL dates cannot express "spring 44 BCE,
year-precision, Julian calendar." Ordinals make range queries and indexes trivial
(`int8range` + GiST). This is the single most load-bearing decision in the system;
full spec in doc 03 §3.

## ADR-016 · iOS: native Swift/SwiftUI app with MapLibre Native, sharing all platform contracts

**Context.** Chronos ships on web and iOS as first-class platforms (doc 00 §7).
Options: native Swift, React Native, Flutter, wrapped PWA.

**Decision.** Fully native iOS app: Swift + SwiftUI, MapLibre Native for the map,
Apollo iOS (codegen from the same persisted GraphQL operations), GRDB/SQLite for
offline caches (study packs, SRS state, recently-viewed snapshots), WidgetKit for
"this day in history"/daily-challenge widgets, local+push notifications for SRS
reviews. No business logic in the client beyond presentation and offline sync; the
`historical-date` formatting/bucketing spec gets a Swift implementation tested
against the shared golden vectors (ADR-001 pattern).

**Rationale.** The map/timeline instrument demands native gesture fidelity and
rendering performance; MapLibre Native consumes the exact same vector tiles and
(style-spec) styling as the web client, so cartography is authored once.
Cross-platform frameworks would compromise the product's core interaction and add
a dependency layer with worse decade-survival odds than Swift + MapLibre.

**Consequences.** Three implementations of a small shared spec (TS, Python, Swift)
— accepted, contained by golden-vector testing. Android later reuses the same
contracts (MapLibre Native runs there too); it is deferred, not precluded.

## ADR-017 · Open contribution model: anyone proposes, AI validates, humans approve

**Context.** Chronos should grow like Wikipedia — by community contribution — but
its claims are structured, dated, sourced assertions, not prose, and correctness
is the brand.

**Decision.** Contribution is open to any registered user and always flows through
the single curation pipeline (doc 01 §5.2): **propose → AI validation gate →
human review → canon**. There is no direct-edit path for anyone, staff included.
The AI gate (ai-assist module) runs automatically on every proposal: source
verification and citation completeness, temporal-consistency checks against
existing canon, geometry validation, duplicate/conflict detection, license
compliance, vandalism/spam scoring — and produces a structured **review brief**
for the human reviewer. Reviewers are staff editors plus community members promoted
by track record. A reputation system tiers contributors (new → established →
trusted → reviewer); higher tiers get expedited review, never review-exemption for
canonical facts. Contested region-periods can be **protected** (higher review bar,
senior editors only).

**Rationale.** Wikipedia proves open contribution scales knowledge; its failure
modes (edit wars, vandalism, uncited claims) are structural, and Chronos's
assertion model + mandatory pipeline addresses them by construction. AI triage
keeps the human review queue tractable at scale; humans keep the AI honest
(ADR-014: AI never writes canon).

**Consequences.** Review latency is a product metric from the day public
contribution opens (Epoch 7); staff review capacity is a launch constraint;
moderation, reputation, and protection tooling are roadmap phases, not
afterthoughts.

---

## Deferred / watched decisions

| Topic                                     | Current stance                                 | Trigger to decide                                   |
| ----------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| Kubernetes                                | Not yet (ADR-012)                              | >3 runtime services or multi-region                 |
| Dedicated graph read store                | Not yet (ADR-006)                              | Deep-traversal features (path queries, centrality)  |
| Kafka                                     | Not yet (ADR-011)                              | Event volume / multi-consumer fan-out pain          |
| Android app                               | Not yet; iOS is the native reference (ADR-016) | Post-launch demand; same contracts, MapLibre Native |
| 3D globe / terrain through time           | MapLibre globe projection first                | Epoch 8 exploration                                 |
| Raster time-series (climate/paleo layers) | COG + raster tiles, additive pipeline          | Climate-layer phases (Epoch 5)                      |
| Federation/API ecosystem                  | Public read API in Epoch 8                     | Community demand                                    |
