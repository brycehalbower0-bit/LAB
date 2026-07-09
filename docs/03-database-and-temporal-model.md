# 03 — Database & Temporal Model

**Status:** Normative · **Owner:** Database Architect · **Last updated:** 2026-07-09

This is the most load-bearing document in the blueprint. It defines how Chronos
represents knowledge: entities, historical time, assertions, geometry through time,
relationships, revisions, and the snapshot read model. SQL below is illustrative
schema *strategy*; exact DDL lands with each roadmap phase's migrations.

---

## 1. First Principles

1. **The unit of knowledge is the assertion, not the row.** An assertion says:
   *subject entity S has property/relationship P with value V, valid during
   interval T (with precision/bounds), according to sources Σ, with confidence C.*
2. **Bitemporality.** We track *valid time* (when it was true in history) and
   *record time* (when our database said so — via the revision system). "What did
   Chronos claim about 1848 as of last March?" must be answerable.
3. **Sources are entities.** Citations are first-class rows, joinable and reusable,
   never free-text afterthoughts.
4. **Uncertainty is data.** Precision, bounds, certainty classes, and confidence
   live in columns, not in prose.
5. **Canonical ≠ serving.** Everything here describes the canonical plane; read
   models (snapshots, tiles, indexes) are derived and disposable (doc 01 §4).

## 2. Entity Registry (`core` schema)

Every knowable thing — place, polity, person, event, treaty, language, religion,
currency, work, idea, source — is an **entity** with one row in the registry and
detail rows in its owning module's schema.

```sql
CREATE TABLE core.entity (
  id            ulid PRIMARY KEY,
  kind          core.entity_kind NOT NULL,   -- 'place','polity','person','event',
                                             -- 'treaty','language','religion',
                                             -- 'currency','work','idea','source',...
  public_id     text UNIQUE NOT NULL,        -- 'pol_01H8...' (prefix = kind)
  slug          text UNIQUE,                 -- human URL: 'roman-empire'
  status        core.entity_status NOT NULL DEFAULT 'active',  -- active|merged|deprecated
  merged_into   ulid REFERENCES core.entity(id),               -- permanent redirects
  created_rev   bigint NOT NULL,             -- revision that created it
  search_hint   text                         -- denormalized primary label (rebuildable)
);
```

- IDs are never reused; merges leave redirects (ADR-008).
- `core.entity_name` holds all names: multilingual, dated (Byzantium → Constantinople
  → Istanbul), typed (official, common, historical, endonym, exonym, transliteration),
  each itself an assertion with sources.
- `core.external_id` maps entities to Wikidata/GeoNames/Pleiades/OSM/WHG identifiers.

## 3. HistoricalDate (the time spec — ADR-015)

A `HistoricalDate` is a value type serialized into columns:

| Field | Type | Meaning |
|---|---|---|
| `ordinal` | int64 | Julian Day Number of the date's midpoint anchor (astronomical numbering; supports deep prehistory) |
| `precision` | enum | `day, month, season, year, decade, century, millennium, era` |
| `earliest` | int64 NULL | Lower bound ordinal when the date itself is uncertain ("between 1235 and 1241") |
| `latest` | int64 NULL | Upper bound ordinal |
| `calendar` | enum | Calendar of record for display/scholarship: `gregorian, julian, islamic, ...` (ordinal is always calendar-independent) |

An **interval** `[start HistoricalDate, end HistoricalDate)` describes validity;
`end = NULL` means "ongoing." For indexing, every interval also materializes an
`int8range` column `valid_range` = `[start.earliest_effective, end.latest_effective)`
with a GiST index — the *generous* range, so temporal queries never miss uncertain
rows; precision-aware refinement happens in the query layer.

Rules:

- **Never** store historical time in `date`/`timestamp` columns.
- Precision is honest: "founded in the 8th century BCE" is
  `(ordinal≈mid-750 BCE, precision=century)` — the UI renders "8th century BCE,"
  never "April 21, 753 BCE" unless a source-backed day-precision assertion exists
  (and legendary dates are stored as assertions with `interpretation='traditional'`).
- The `historical-date` library (TS + Python mirror, shared golden test vectors)
  owns parsing, arithmetic, comparison, formatting, BCE/CE display, and
  Julian↔Gregorian conversion. It is Phase 5 and everything depends on it.

## 4. The Assertion Model

Module tables are **assertion tables**: each row is one dated, sourced claim.
The shared shape (mixin columns on every assertion table):

```sql
-- Mixin present on every assertion table:
  id             ulid PRIMARY KEY,
  subject_id     ulid NOT NULL REFERENCES core.entity(id),
  valid_start_*  /* HistoricalDate columns */,
  valid_end_*    /* HistoricalDate columns, NULLable = ongoing */,
  valid_range    int8range NOT NULL,          -- generated, GiST-indexed
  confidence     smallint NOT NULL DEFAULT 100, -- 0–100 editorial confidence
  interpretation core.interpretation NOT NULL DEFAULT 'accepted',
                  -- accepted | disputed | traditional | conjectural | superseded
  primacy        boolean NOT NULL DEFAULT true, -- primary view among alternatives
  note           text,
  created_rev    bigint NOT NULL,
  retired_rev    bigint                        -- record-time end (bitemporal)
```

Example assertion tables (per module):

- `polity.existence` (polity exists as sovereign/vassal/colony/… during interval)
- `polity.border_claim` (polity ↔ geometry version, certainty class)
- `polity.capital` (polity ↔ place)
- `polity.leadership` (polity ↔ person ↔ office)
- `polity.currency_use`, `polity.government_form`, `polity.flag`
- `gazetteer.place_geometry`, `gazetteer.population_estimate` (value + range!)
- `person.life` (birth/death with full HistoricalDate uncertainty), `person.role`
- `culture.language_distribution`, `culture.religion_distribution`
- `event.occurrence` (the event's own when/where), `event.participation`

**Conflicting interpretations** coexist as multiple assertions on the same subject
and overlapping validity, distinguished by `interpretation`/`primacy` — editorial
selects the primary; alternatives remain queryable and visible in "scholarship" UI.

**Citations:**

```sql
CREATE TABLE core.citation (
  assertion_table  regclass NOT NULL,
  assertion_id     ulid NOT NULL,
  source_id        ulid NOT NULL REFERENCES core.entity(id), -- kind='source'
  locator          text,          -- page, URL fragment, dataset row
  support          core.support NOT NULL DEFAULT 'supports'  -- supports|disputes|mentions
);
```

Every assertion must have ≥1 citation to reach `accepted`; pipeline-imported rows
cite their dataset+version as the source until better citations arrive.

## 5. Geometry Through Time (`gazetteer` + `polity`)

Geometry is versioned and shared:

```sql
CREATE TABLE gazetteer.geometry_version (
  id           ulid PRIMARY KEY,
  geom         geometry NOT NULL,            -- PostGIS, EPSG:4326
  geom_kind    text NOT NULL,                -- point|line|polygon|multipolygon
  gen_levels   jsonb,                        -- refs to simplified variants for tiling
  source_id    ulid NOT NULL,                -- dataset/map it was digitized from
  method       text                          -- digitized|imported|derived|drawn
);

CREATE TABLE polity.border_claim (          -- assertion mixin +
  geometry_id  ulid NOT NULL REFERENCES gazetteer.geometry_version(id),
  certainty    polity.border_certainty NOT NULL,
   -- 'surveyed' | 'treaty_defined' | 'approximate' | 'frontier_zone'
   -- | 'disputed' | 'conjectural'
  claim_kind   text NOT NULL DEFAULT 'de_facto'  -- de_facto|de_jure|claimed|occupied
);
```

Principles:

- **Snapshot-geometry model, not edge-topology model, at first.** Each border claim
  references a complete polygon valid for an interval. A shared-boundary topology
  model (borders as arcs shared between neighbors) is a known future optimization
  (Epoch 8 candidate) — the schema isolates geometry behind `geometry_version` so
  the swap doesn't touch assertions.
- Disputed/overlapping control is *expected*: overlapping `border_claim`s with
  different `claim_kind`/`certainty` render as the atlas layer dictates.
- Frontier zones (steppe empires, pre-modern "borders") are polygons with
  `certainty='frontier_zone'` and get gradient rendering, not crisp lines.
- Every geometry stores its provenance; redrawing creates a new version, never
  mutates.

## 6. The Knowledge Graph (`graph` schema)

All typed relationships not owned by a specific module land in one edge store:

```sql
CREATE TABLE graph.edge (      -- assertion mixin (subject = src) +
  src_id     ulid NOT NULL REFERENCES core.entity(id),
  dst_id     ulid NOT NULL REFERENCES core.entity(id),
  rel        graph.rel_type NOT NULL,  -- controlled vocabulary, versioned:
             -- part_of, successor_of, capital_of*, fought_in, signed, ruled*,
             -- located_in, influenced, member_of, caused, resulted_from,
             -- discovered, authored, spread_to, allied_with, at_war_with, ...
  strength   real                       -- optional weight for relatedness
);
```

(*) Where a module owns a richer table (e.g., `polity.capital`), the graph edge is
a *projection* maintained by the event bus — the module table is truth, the edge
makes it traversable. The relationship vocabulary is governed (additions require a
curation-approved vocabulary revision) to prevent decades of synonym rot.

## 7. The World Snapshot Read Model (`snapshot`)

`worldSnapshot(at T, region?, layers?)` answers doc 00 §5.3. Canonical queries are
straightforward (`valid_range @> T` joins), but assembling a full snapshot touches
many tables — so snapshots are **materialized per (time-bucket, region-cell)**:

- Time buckets follow per-era resolution (doc 00 §5.2): century buckets in deep
  antiquity, year buckets 1500+, month buckets recent.
- Region cells are coarse (continent → country-scale grid) so panel queries touch
  few cells.
- Stored as JSONB documents keyed `(bucket, cell, layer, revision_watermark)`;
  invalidated by `entity.changed` events whose valid-time × geometry intersects.
- Always rebuildable; never authoritative.

The same bucketing drives **tile invalidation** (a border edit for 1810–1815
invalidates only those year-buckets' political tiles in affected cells).

## 8. Revisions & Bitemporality (`curation` schema)

```sql
CREATE TABLE curation.revision (
  rev          bigserial PRIMARY KEY,
  actor_id     ulid NOT NULL,               -- user | pipeline | ai-assist agent
  kind         text NOT NULL,               -- edit|import|merge|rollback|vocab
  summary      text NOT NULL,
  proposal_id  ulid,                        -- review-queue linkage
  committed_at timestamptz NOT NULL,        -- machine time is fine here
  parent_rev   bigint
);
CREATE TABLE curation.revision_change (     -- the diff, structured
  rev          bigint REFERENCES curation.revision(rev),
  table_name   regclass NOT NULL,
  row_id       ulid NOT NULL,
  op           text NOT NULL,               -- insert|retire|amend
  before       jsonb,
  after        jsonb
);
```

- Canonical rows are **never physically updated or deleted**: an edit retires the
  old assertion (`retired_rev`) and inserts a replacement (`created_rev`). This
  yields record-time travel, diffs, and rollback (inverse revision) for free.
- "As-of record time R" queries filter `created_rev <= R AND (retired_rev IS NULL
  OR retired_rev > R)`.
- Bulk imports are revisions too — a dataset drop is one revision with thousands of
  changes, reviewable and reversible as a unit.

## 9. Learning & Identity Data (separate concerns)

- `learning.*` (quiz items, SRS state, attempts, mastery) references entity IDs but
  lives apart; quiz items carry `derived_from` assertion references so fact changes
  flag dependent items.
- `identity.*` holds accounts/roles/preferences. Personal data (SRS state,
  attempts, analytics) is isolated for GDPR export/erasure without touching the
  knowledge base.

## 10. Scale Strategy

Assume: 10⁶–10⁷ entities; 10⁷–10⁸ assertions; 10⁵–10⁶ geometry versions (borders
dominate); 10⁸+ learning events.

- **Indexes:** GiST on `valid_range` and `geom`; B-tree on `(subject_id)`,
  `(rel, dst_id)`; partial indexes on `retired_rev IS NULL` (live view) — most
  queries hit only live assertions.
- **Partitioning:** learning events and telemetry partitioned by month from day
  one; assertion tables partitioned only if/when measured (live-row partial
  indexes usually suffice).
- **Live views:** each module exposes `*_live` views (`retired_rev IS NULL AND
  primacy`) so application code reads simply and bitemporal complexity stays fenced.
- **Geometry weight:** full-resolution geometries never leave the database except
  into tile builds; APIs serve simplified variants via `gen_levels`.
- **Read replicas** for GraphQL reads (Stage B); snapshot/tile/search stores absorb
  the heaviest read traffic before the DB ever feels it.

## 11. Schema Governance

- Migrations: per-module, forward-only, expand→backfill→contract; reviewed like
  code; rehearsed against production-scale fixtures from Epoch 4 onward.
- The assertion mixin, HistoricalDate serialization, and citation shape may only
  change via ADR + a dedicated roadmap phase — they are the platform's bedrock.
- Every table, column, and enum is documented in schema docs generated from the
  migrations (Phase 6 tooling) — undocumented schema fails CI.
