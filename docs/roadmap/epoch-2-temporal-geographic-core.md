# Epoch 2 — Temporal & Geographic Core (Phases 13–25)

**Theme:** a complete, correct, sourced _modern world_ — the reference frame every
historical layer diffs against (doc 04 §2) — plus the map+timeline instrument v1.
Exit state: explore today's Earth on the instrument, open place pages with
provenance, search places by any name.

---

### Phase 13 — Gazetteer module: places & names — `PLANNED`

**Objective.** The `gazetteer` module: place entities, historical/multilingual names as assertions, place kinds and hierarchy.
**Requirements.** Place detail tables (kind: settlement, region, river, mountain, sea…); containment hierarchy as dated assertions; name assertions wired to `core.entity_name`; location timeline query ("all assertions about this place ordered in time").
**Acceptance.** Create places with dated names and containment via curation kernel; timeline query returns ordered, cited assertions; module docs/README complete.
**DB.** `gazetteer.place`, hierarchy/containment assertion tables.
**API.** `place(id)` GraphQL with names + hierarchy. **Frontend.** —
**Testing.** Unit + property tests on containment cycles (forbidden) and name-at-T resolution.
**Docs.** Gazetteer charter README.
**Depends on.** P6, P7, P9. **Risks.** Over-modeling kinds; start with a governed enum.
**Future.** Geometry attaches in P14; pages in P22.
**Estimate.** 1.5 weeks.

### Phase 14 — Geometry versioning & spatial layer — `PLANNED`

**Objective.** Implement `gazetteer.geometry_version` (doc 03 §5): immutable geometries with provenance, simplification variants, place-geometry assertions.
**Requirements.** PostGIS storage (EPSG:4326), validity enforcement (ST_IsValid + repair pipeline), generalization variant generation (per zoom band), `place_geometry` assertion table; spatial+temporal combined query helpers (`geom && bbox AND valid_range @> T`).
**Acceptance.** Import a test geometry set with variants; combined space-time queries meet index plans (EXPLAIN-verified); invalid geometry rejected with actionable errors.
**DB.** `gazetteer.geometry_version`, `gazetteer.place_geometry`; GiST indexes.
**API.** Geometry (simplified) exposure on `place`. **Frontend.** —
**Testing.** Geometry validity fuzz tests; index-plan regression tests.
**Docs.** Geometry handling guide (provenance, variants, tolerances).
**Depends on.** P13. **Risks.** Storing only full-res would melt tile builds — variants are required now, not later.
**Future.** Border claims (P29) reference these versions; topology model is an Epoch 8+ candidate (doc 03 §5).
**Estimate.** 2 weeks.

### Phase 15 — Pipeline framework & Natural Earth ingestion — `PLANNED`

**Objective.** The Python pipeline framework (fetch→normalize→reconcile→validate→stage→propose, doc 04 §3) proven on Natural Earth: modern countries, admin-1, cities, physical features.
**Requirements.** `/pipelines` skeleton (typed configs, versioned raw drops to object storage, checksums, idempotent re-runs, golden-file tests); source registry entries with verified licenses (gate enforced); Natural Earth → places + geometries + names as one reviewable bulk proposal; Python `historical-date` + ID mirrors used in anger.
**Acceptance.** One command ingests NE at chosen scale into staging canon via a curation revision; re-run is a no-op; rollback removes the import cleanly; golden-file tests cover normalization.
**DB.** Staging tables (`pipeline_stage` role). **API.** — **Frontend.** —
**Testing.** Golden files; idempotency test; license-gate test (unverified source refuses).
**Docs.** Pipeline authoring guide + NE runbook.
**Depends on.** P7, P13, P14. **Risks.** Framework gold-plating; NE is deliberately the easy first source.
**Future.** Every subsequent source reuses this frame.
**Estimate.** 2.5 weeks.

### Phase 16 — geoBoundaries + GeoNames ingestion & reconciliation queue — `PLANNED`

**Objective.** Admin boundaries and the name-rich gazetteer seed; first real entity-resolution workload.
**Requirements.** geoBoundaries (admin levels) and GeoNames (names, alternates, hierarchy) pipelines; reconciliation: external-ID first, then scored name+space matching; ambiguous matches land in a persisted reconciliation queue (data model + minimal internal UI later in admin epoch — for now, CSV/CLI review).
**Acceptance.** Modern admin-1/admin-2 and populated-places coverage with alternate names; ambiguous-match queue populated and drainable; no auto-merge ever (doc 04 §3).
**DB.** Reconciliation queue tables. **API.** — **Frontend.** —
**Testing.** Reconciliation scoring unit tests with tricky fixtures (San José×n).
**Docs.** Reconciliation policy + runbooks per source.
**Depends on.** P15. **Risks.** GeoNames noise — cap import scope to populated places + features we render.
**Future.** Wikidata reconciliation (P28) reuses the queue.
**Estimate.** 2 weeks.

### Phase 17 — Tile service & "today" political layer — `PLANNED`

**Objective.** Stand up `chronos-tiles` (Martin) + the tile manifest contract (doc 05 §3.2); serve the modern political + places layers.
**Requirements.** Dynamic `ST_AsMVT` endpoints over live views; prebuilt tileset path (tippecanoe) with content-hash addressing to object storage/CDN; `/tiles/manifest` v1; feature properties carry `entityId` (+`certainty` placeholder).
**Acceptance.** Political + cities tiles render in a scratch client at all zooms within perf budgets (doc 05 §7); manifest maps `at=today` to concrete URLs; CDN caching verified (immutable URLs).
**DB.** Tile-source SQL views. **API.** Tile endpoints + manifest. **Frontend.** Scratch viewer only.
**Testing.** Tile snapshot tests (golden pbf property sets); load test to budget.
**Docs.** Tile contract reference; tiles runbook.
**Depends on.** P14, P15, P16. **Risks.** Perf tuning rabbit holes — budget-driven, then move on.
**Future.** Time-parameterized buckets in P31.
**Estimate.** 2 weeks.

### Phase 18 — Map instrument v1 (web) — `PLANNED`

**Objective.** The full-bleed MapLibre map in the web shell: layer tray skeleton, selection, context panel shell (doc 06 §1 minus time).
**Requirements.** MapLibre GL JS integration; style built from design-system cartographic tokens; hover/select wired to `entityId` → GraphQL preview card; layer tray (political, cities, terrain); URL state for viewport+layers; keyboard operability + reduced-motion basics.
**Acceptance.** Pan/zoom/select the modern world smoothly (60fps target hardware); clicking a country/city opens its preview with provenance affordance; view state shareable via URL.
**DB.** — **API.** Consumes tiles + entity queries. **Frontend.** Map instrument, layer tray, context panel shell.
**Testing.** Playwright E2E (load→select→preview); visual regression on styled tiles.
**Docs.** Instrument architecture notes (state coupling contract).
**Depends on.** P11, P17. **Risks.** State-coupling sloppiness now costs Epoch 3 dearly — the (T, viewport, layers, selection) store contract is review-gated.
**Future.** Timeline coupling in P19/P32.
**Estimate.** 2.5 weeks.

### Phase 19 — Timeline UI v1 — `PLANNED`

**Objective.** The zoomable multi-resolution timeline control, integrated with URL state and the store — operating on `today ± recent` until historical data arrives.
**Requirements.** Canvas/SVG timeline with temporal zoom (era→century→decade→year→month), resolution quantization driven by data-declared support (stubbed to modern for now), scrub + play affordances, HistoricalDate formatting throughout, `?at=` URL param, a11y (arrow-key scrubbing, announced T).
**Acceptance.** Scrub and zoom feel right on desktop + touch web (user-testable prototype); T changes propagate to store/URL; quantization visibly communicates resolution; formatting matches historical-date golden vectors.
**DB.** — **API.** — **Frontend.** Timeline component + store integration.
**Testing.** Component interaction tests; formatting golden tests; E2E scrub.
**Docs.** Timeline interaction spec (the reference for iOS parity later).
**Depends on.** P5, P18. **Risks.** This control is the product's signature — schedule a design iteration loop, not one pass.
**Future.** Map coupling + morphing in P32; haptic iOS variant P73.
**Estimate.** 2.5 weeks.

### Phase 20 — Temporal query layer & entity-at-T — `PLANNED`

**Objective.** The generic "state of entity E at time T" and "assertions in window W" query services over the assertion framework — the engine snapshots and pages will share.
**Requirements.** Query builders honoring generous ranges + precision refinement (doc 03 §3); primacy/interpretation filtering; `entity(id, at:)` GraphQL behavior (doc 05 §2.1); `timeline(focus, window, resolution)` v1 returning bucketed assertion events.
**Acceptance.** Given fixture data with uncertainty, at-T queries return correct primary state incl. boundary cases (assertion starting "c. 1848" appears in 1848±per spec); EXPLAIN-verified index usage; API contract tests.
**DB.** Helper functions/views. **API.** `at:` argument live; `timeline` query v1. **Frontend.** Context panel shows selection-at-T.
**Testing.** Property tests against a randomized assertion generator (the temporal oracle suite — a permanent asset).
**Docs.** Temporal query semantics spec (normative).
**Depends on.** P6, P19. **Risks.** Semantics subtleties (what does year-precision "1848" contain?) — spec first, then code.
**Future.** Snapshot engine (P21) composes these.
**Estimate.** 2 weeks.

### Phase 21 — Snapshot module v1 (modern era) — `PLANNED`

**Objective.** `worldSnapshot(at, region, layers)` for the modern world: composition, bucketing, caching, invalidation (doc 03 §7).
**Requirements.** Snapshot assembly over gazetteer (+polity stubs until Epoch 3) with per-item citations/confidence; JSONB materialization keyed (bucket, cell, layer, watermark); `entity.changed` consumer invalidating precisely; `revisionWatermark` in responses.
**Acceptance.** Modern snapshot p95 <150ms warm / <1.5s cold (doc 05 §7); editing a fixture place via curation invalidates exactly the affected cells (test); partial-failure returns partial data + typed errors.
**DB.** Snapshot cache tables. **API.** `worldSnapshot` v1. **Frontend.** Context panel renders world-mode snapshot cards.
**Testing.** Invalidation-precision integration tests; perf tests in CI (budget-gated).
**Docs.** Snapshot design notes; event catalog updated.
**Depends on.** P8, P20. **Risks.** Over-general cell/bucket scheme — start coarse, measure.
**Future.** Political content (P34), events (P47) enrich the same engine.
**Estimate.** 2 weeks.

### Phase 22 — Place pages v1 (temporal dossier skeleton) — `PLANNED`

**Objective.** The entity-page architecture (doc 06 §3) realized for places: header, mini-timeline ribbon, fact panels, citations everywhere.
**Requirements.** Page layout components (shared by all future kinds); name-at-T header; assertion-backed fact rows with provenance popovers (source, confidence, alternatives); location timeline section; map thumbnail (place at current T); zero-dead-end rule (related links even in v1 — hierarchy + nearby).
**Acceptance.** Any imported place renders a complete, cited page; provenance popover shows real sources; mini-timeline moves global T; Lighthouse a11y ≥95.
**DB.** — **API.** Page query (persisted). **Frontend.** Dossier component system.
**Testing.** E2E (search→page→provenance→timeline-jump); visual regression.
**Docs.** Page architecture guide (the template all kinds follow).
**Depends on.** P20, P21. **Risks.** Skimping on the provenance UI would betray doc 00 §9 "Trust" — it is v1 scope, not polish.
**Future.** Country pages (P35), city pages (P53), person/event pages (Epoch 4) reuse this system.
**Estimate.** 2 weeks.

### Phase 23 — Search v1 (Postgres FTS) — `PLANNED`

**Objective.** Interim omnisearch over entities: names (all languages/alternates), kinds, basic ranking; the ⌘K surface (doc 06 §4).
**Requirements.** FTS/trigram indexes over entity names; search service module (interface stable so the OpenSearch swap in P48 is invisible); search-as-you-type API within budget; date-input detection ("1848" offers "jump timeline").
**Acceptance.** "Paris", "München", misspellings within trigram tolerance resolve; p95 <150ms; keyboard-first UX.
**DB.** Search indexes on names. **API.** `search(q, kinds)` v1. **Frontend.** Omnisearch component.
**Testing.** Relevance fixture suite (assertions on top-3 results — carried forward to P48).
**Docs.** Search module charter (interim status noted).
**Depends on.** P13, P16, P22. **Risks.** None serious; deliberately temporary internals.
**Future.** Time-aware + NL search P48–49.
**Estimate.** 1.5 weeks.

### Phase 24 — Media module v1 — `PLANNED`

**Objective.** Store and serve images/maps/documents with per-item licensing (doc 04 §1.3 Commons discipline).
**Requirements.** Object-storage backed media entities (license, attribution, source, dated relation to entities); responsive derivatives; signed admin upload; attribution rendering component; Wikimedia Commons fetch helper (license metadata imported, not assumed).
**Acceptance.** Attach media to a place; page renders with correct attribution stack; license-unknown media cannot publish.
**DB.** `core.media` (+relations). **API.** Media REST + GraphQL exposure. **Frontend.** Media panel + lightbox with attribution.
**Testing.** License-gate tests; derivative pipeline tests.
**Docs.** Media & licensing runbook.
**Depends on.** P15, P22. **Risks.** License metadata quality — refuse-on-unknown is the rule.
**Future.** Historical map overlays (georeferenced) are an Epoch 5+ extension.
**Estimate.** 1.5 weeks.

### Phase 25 — Epoch 2 review, perf baseline & "World Today" known world — `PLANNED`

**Objective.** Lock the modern world as the first regression fixture; audit architecture; re-scope Epoch 3 with real data experience.
**Requirements.** "World Today" known-world fixture (snapshot + tiles + representative pages golden-filed, doc 08 §6); perf budget dashboard vs doc 05 §7; temporal-oracle suite green; docs/CHANGELOG/roadmap updates; user-test the instrument prototype with ≥5 outsiders, findings recorded.
**Acceptance.** Fixture diffs gated in CI; review report merged; Epoch 3 phases confirmed/revised; all Epoch 2 phases DONE-stamped.
**DB/API/Frontend.** Stabilization only.
**Testing.** The fixture _is_ the deliverable.
**Docs.** Epoch 2 review report.
**Depends on.** P13–P24. **Risks.** Fixture brittleness — golden-file with structured, explainable diffs.
**Future.** Every epoch adds known worlds.
**Estimate.** 1.5 weeks.

---

**Epoch 2 total: ~26 weeks (≈6 months).**
