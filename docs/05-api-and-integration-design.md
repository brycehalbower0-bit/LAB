# 05 — API & Integration Design

**Status:** Normative · **Owner:** Technical Lead · **Last updated:** 2026-07-09

Contracts between the platform and its clients (web app, native iOS app, admin,
future public consumers). Governing ADRs: ADR-009 (GraphQL+REST split), ADR-008
(identifiers), ADR-016 (iOS client), ADR-017 (contribution model).

---

## 1. Surface Overview

| Surface         | Protocol                        | Consumers                                        | Notes                                                         |
| --------------- | ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Knowledge API   | GraphQL                         | Web app, iOS app, admin, SSR layer               | Primary read surface; persisted queries in production         |
| Tile API        | REST (HTTP GET, immutable URLs) | Web + iOS map clients, CDN                       | `pbf` vector tiles, raster tiles for climate/terrain          |
| Learning API    | GraphQL mutations + queries     | Web app, iOS app                                 | Sessions, answers, SRS scheduling; iOS syncs offline attempts |
| Curation API    | GraphQL mutations               | Web app (public proposals), admin app, pipelines | Proposals, AI-gate results, reviews, imports, rollback        |
| Media API       | REST                            | All                                              | Images, historical maps, exports; signed upload for admin     |
| Public API v1   | REST (OpenAPI)                  | External developers                              | Epoch 8; keyed, quota'd, stable                               |
| Webhooks/Events | HTTP push                       | Future integrators                               | Epoch 8                                                       |

## 2. GraphQL Design Principles

1. **Time is an argument everywhere it matters.**
   ```graphql
   type Query {
     worldSnapshot(at: HistoricalDate!, region: RegionInput, layers: [LayerKey!]): WorldSnapshot!
     entity(id: ID!, at: HistoricalDate): Entity
     polity(id: ID!): Polity # full-history view
     place(id: ID!): Place
     search(q: String!, at: HistoricalDate, kinds: [EntityKind!], first: Int): SearchResults!
     timeline(focus: ID!, window: HistoricalInterval, resolution: TimeResolution): Timeline!
   }
   ```
   Omitting `at` returns the full-history view (page mode); providing it returns
   the state-at-T view (map/snapshot mode).
2. **`HistoricalDate` is a custom scalar** serialized per the doc 03 §3 spec —
   `{ordinal, precision, earliest?, latest?, calendar?}` — with a human string form
   (`"1848"`, `"c. 750 BCE"`, `"1914-06-28"`) accepted on input.
3. **Every fact-bearing field can expose its assertions.** Interfaces:
   ```graphql
   interface Asserted {
     confidence: Int!
     interpretation: Interpretation!
     validTime: HistoricalInterval!
     citations: [Citation!]!
   }
   ```
   Page UIs read the plain value; the provenance popover queries the `Asserted`
   view. Alternatives: `assertionsFor(property: …) { … }` returns non-primary rows.
4. **Relay-style pagination and global object identification** (`node(id:)`),
   merged-entity redirects resolved server-side with a `redirectedFrom` field.
5. **Read-only by default.** No mutation writes canonical facts directly — fact
   writes exist only as curation proposals (§4).
6. **Persisted queries + `@cacheControl`** hints; snapshot queries carry a
   `revisionWatermark` so clients/CDN can cache aggressively and invalidate
   precisely.

## 3. The Snapshot & Tile Contracts (the core of the product)

### 3.1 `worldSnapshot`

Returns, for time T (bucketed server-side per doc 03 §7): polities (with capital,
government form, leader, certainty), active wars/treaties, notable events near T,
births/deaths near T, cultural/discovery items, population highlights, each entry
carrying entity IDs + citation refs + confidence. Response includes
`{bucket, resolution, revisionWatermark}` metadata so the client can display honest
resolution ("showing 1848, year resolution").

### 3.2 Tiles

```
GET /tiles/{layer}/{timeBucket}/{z}/{x}/{y}.pbf
    layer:      political | admin | cities | routes | conflict | religion | ...
    timeBucket: layer-resolution token, e.g. y1848, d1840 (decade), c-0500 (century)
```

- URLs are immutable per `(layer, bucket, tileset-build)`; builds are addressed by
  content hash; `/tiles/manifest?at=…&layers=…` maps a HistoricalDate to concrete
  bucket URLs + style version — the only mutable tile endpoint (short TTL).
- Feature properties carry `entityId`, `certainty`, `claimKind` so the client
  styles disputes/frontiers and wires clicks to GraphQL without extra lookups.

## 4. Curation API (writes)

All writes flow: `proposeRevision(changes, sources, rationale)` →
automatic AI validation gate (attaches a review brief or bounces with reasons) →
`reviewRevision(id, verdict, comments)` → commit/rollback. Public contributors and
staff use the same mutations — routing, required reviewer role, and expedition are
functions of reputation tier and topic protection (ADR-017). Bulk import = one
proposal with a batch payload reference. Vocabulary changes (relationship types,
certainty classes) use the same path with elevated required roles. Every commit
returns the new `rev` watermark. Direct SQL to canonical tables is a firing
offense enforced by role separation at the DB level.

## 5. Versioning & Compatibility

- **GraphQL:** additive evolution; deprecations with `@deprecated(reason, since)`;
  removal only after telemetry shows zero production use for 2 release cycles.
  Breaking change = new field/type, never repurposed semantics.
- **REST/tiles:** versioned paths (`/v1/`); tile schema (feature property names) is
  versioned in the style manifest.
- **Public API v1 (Epoch 8):** OpenAPI-specified, semver'd, changelogged, with
  documented data-license terms per response (attribution stack included in
  payloads).
- **Client/server drift:** the web app pins a compatible API range; SDL snapshots
  and contract tests in CI catch accidental breaks.

## 6. AuthN/AuthZ

- OIDC (Authorization Code + PKCE) for users; short-lived JWT access tokens with
  role claims; API keys (hashed, scoped, quota'd) for the public API.
- Roles: `reader < learner < contributor < reviewer < editor < admin`.
  GraphQL fields/mutations declare required roles in schema decorators; the
  permission matrix lives in doc 08 §3.
- Anonymous read access to public knowledge is a product commitment; learning and
  contribution require accounts.

## 7. Performance Contracts (budgets, enforced by perf tests from Epoch 4)

| Operation                         | Budget (p95)       |
| --------------------------------- | ------------------ |
| Tile fetch (CDN hit)              | < 50 ms            |
| Tile fetch (server render)        | < 300 ms           |
| `worldSnapshot` (cache hit)       | < 150 ms           |
| `worldSnapshot` (cold)            | < 1.5 s            |
| Entity page query                 | < 300 ms           |
| Search-as-you-type                | < 150 ms           |
| Timeline scrub tile-swap (client) | < 100 ms perceived |

## 8. Error & Result Conventions

- GraphQL: typed error extensions (`code`, `entityId`, `retryable`); partial data
  with `errors[]` is legitimate for snapshot assembly (a missing layer must not
  blank the map).
- REST: RFC 9457 problem+json.
- Nothing 500s silently: every error path is logged with correlation IDs and
  surfaced in observability dashboards.
