# Epoch 4 — Events, People & Knowledge Graph (Phases 39–51)

**Theme:** history's _content_ — events, wars, treaties, people — woven into the
graph so every date has knowledge and every page links onward. Exit state: click
any year and see what happened; every entity page shows its dated neighborhood;
real search; shareable server-rendered pages.

---

### Phase 39 — Event module: occurrences, kinds & importance v1 — `PLANNED`

**Objective.** The `event` entity: dated occurrence (when/where with full uncertainty), governed kind vocabulary (battle, treaty-signing, founding, disaster, discovery, election, …), importance score v1.
**Requirements.** `event.occurrence` (HistoricalDate + place/geometry refs), kind enum governance, importance v1 = editorial weight + source density (graph centrality arrives P44); event↔place links.
**Acceptance.** Fixture events (point-in-time, multi-day, century-uncertain) store, query at-T/in-window correctly, and expose citations.
**DB.** `event.*` core. **API.** `event(id)`, `eventsInWindow(...)`. **Frontend.** —
**Testing.** Window-query property tests (uncertainty inclusion semantics).
**Docs.** Event modeling guide.
**Depends on.** Epoch 3 complete. **Risks.** Kind taxonomy sprawl — governed vocabulary, ADR-017 path.
**Future.** Wars/treaties (P41) specialize; snapshot inclusion (P47).
**Estimate.** 2 weeks.

### Phase 40 — Person module: lives & roles — `PLANNED`

**Objective.** The `person` entity: lifespans (uncertainty-first: "c. 1162"), roles, affiliations; re-point Epoch 3 leadership stubs to real person records.
**Requirements.** `person.life`, `person.role`; leadership migration (expand→backfill→contract); name handling (transliterations, regnal names) via entity_name.
**Acceptance.** Leadership chains from P27/28 resolve to person entities with lifespan sanity flags active; person-at-T ("what was X doing in year Y") answers from roles.
**DB.** `person.*`; leadership FK migration. **API.** `person(id)`. **Frontend.** —
**Testing.** Migration verification; lifespan/role consistency flags.
**Docs.** Person modeling guide.
**Depends on.** P27, P39. **Risks.** Migration on live-ish data — rehearse per doc 03 §11.
**Future.** Person pages P46.
**Estimate.** 2 weeks.

### Phase 41 — Wars, battles & treaties — `PLANNED`

**Objective.** Structured conflict/diplomacy: wars (compound events with phases), battles (child events), treaties (documents + effects), participation with sides/outcomes.
**Requirements.** War/battle/treaty detail tables; `event.participation` (polity/person, side, role, outcome); treaty effects linked to border change events (P30 register) — closing the loop: war → treaty → border delta, all one connected chain; casualty figures as ranged estimates.
**Acceptance.** Franco-Prussian War fixture: war→battles→treaty→border change→polity succession all navigable and cited; participation queries ("wars of Prussia, 1860–1871") correct.
**DB.** Conflict/diplomacy tables. **API.** War/treaty types + queries. **Frontend.** —
**Testing.** Chain-integrity tests (treaty effect must reference existing border delta or flag).
**Docs.** Conflict modeling guide.
**Depends on.** P29/P30 register, P39, P40. **Risks.** Over-modeling battle detail — order-of-battle depth is optional per event, not schema-mandatory.
**Future.** Conflict map layer (P59); COW/UCDP enrichment optional later.
**Estimate.** 2 weeks.

### Phase 42 — Wikidata seed: events & people — `PLANNED`

**Objective.** Populate events (statehood era first: wars, treaties, disasters, elections, discoveries) and people (leaders already present; add major figures) from Wikidata with reconciliation and review.
**Requirements.** Pipelines scoped by importance heuristics (sitelink counts etc. as _inputs_, not truth); dedup against existing events (change-event register!); reliability-class citation policy as P28; batch review sizing.
**Acceptance.** ≥10k reviewed events and ≥10k people with dated, cited assertions; duplicate rate in sampled audit <2%; all reversible.
**DB.** Data. **API/Frontend.** —
**Testing.** Golden files; sampled audit protocol recorded.
**Docs.** Runbook updates (event dedup traps).
**Depends on.** P28 pipeline, P39–P41. **Risks.** Event quality variance — importance-scoped intake + review keeps the bar.
**Future.** Continuous top-up syncs (Epoch 8 ops).
**Estimate.** 2.5 weeks.

### Phase 43 — Knowledge-graph edge store & projections — `PLANNED`

**Objective.** `graph.edge` (doc 03 §6) with the governed vocabulary (doc 07 §1.1); projection consumers that mirror module-owned relations into edges via the event bus.
**Requirements.** Edge assertion table + rel_type governance; projection workers (capital_of, ruled, fought_in, signed, part_of…) idempotent and rebuildable; traversal API (typed, dated, depth≤3) with query budgets.
**Acceptance.** Full projection rebuild from canon matches incremental state (rebuild test); neighborhood query for fixture entities returns correct dated edges within budget.
**DB.** `graph.edge` + projection bookkeeping. **API.** Internal traversal service. **Frontend.** —
**Testing.** Projection rebuild-equivalence tests (permanent guard).
**Docs.** Vocabulary reference + projection catalog.
**Depends on.** P8, P39–P42. **Risks.** Projection drift — rebuild-equivalence in CI is the answer.
**Future.** Relatedness (P44), NL search grounding (P49), quiz distractors (Epoch 6).
**Estimate.** 2 weeks.

### Phase 44 — Neighborhood, relatedness & importance v2 — `PLANNED`

**Objective.** The graph read models: dated neighborhood API for pages, precomputed relatedness (edge-weighted + embedding similarity), importance v2 (adds graph centrality) feeding labels/snapshot/search rank (doc 07 §1.2).
**Requirements.** Relatedness worker + storage; pgvector embeddings for entities (name+summary content); importance recompute worker with editorial override; "Connections" rail component.
**Acceptance.** Connections rail on any entity shows sensible, dated relations (qualitative review protocol + fixture assertions); importance ordering sanity-checked against reference lists; recompute is incremental.
**DB.** Relatedness/importance tables; embeddings. **API.** `connections(id, at?)`. **Frontend.** Connections rail on all pages.
**Testing.** Ranking fixture tests; embedding pipeline tests.
**Docs.** Scoring formulas (versioned — doc 07 §1.2 requirement).
**Depends on.** P43. **Risks.** Score opacity — formulas documented + explainable in admin later.
**Future.** Learning-path recommendations (Epoch 6+).
**Estimate.** 2 weeks.

### Phase 45 — Event & war pages with map visualization — `PLANNED`

**Objective.** Event dossiers: when/where map viz (point, area, front where data allows), participants, cause/consequence display, timeline placement, sources & historiography section (doc 06 §3).
**Requirements.** Dossier panels for events/wars/treaties; map inset rendering occurrence geometry at event T; war pages aggregate battles/phases on map+timeline; educational summary slot (curated text only until AI drafting phase).
**Acceptance.** Waterloo, Congress of Vienna, Franco-Prussian War pages complete, cited, navigable to every participant; map insets correct at T.
**DB.** — **API.** Page queries. **Frontend.** Event/war dossiers.
**Testing.** E2E journeys; visual regression on map insets.
**Docs.** Page architecture updates.
**Depends on.** P41, P44. **Risks.** Front-line geometry scarcity — render honestly (points/areas), no invented fronts.
**Future.** Conflict layer animation (P59); AI-drafted summaries into review (P87).
**Estimate.** 2 weeks.

### Phase 46 — Person pages — `PLANNED`

**Objective.** Person dossiers: life timeline, offices/roles ribbons, affiliations, movements map (dated place links), works, relationships, related events.
**Requirements.** Person panels on the dossier system; office ribbons interoperating with polity leader timelines (two-way nav); uncertainty-forward rendering of contested dates.
**Acceptance.** Napoleon, Bismarck, Victoria pages complete and cross-navigable to polities/wars/treaties/places; contested birthdate fixture renders with honest precision.
**DB.** — **API.** Page queries. **Frontend.** Person dossier.
**Testing.** E2E; timeline-ribbon component tests.
**Docs.** Updates.
**Depends on.** P40, P44. **Risks.** Low.
**Future.** Person quizzes (Epoch 6).
**Estimate.** 1.5 weeks.

### Phase 47 — Snapshot v3: "every date has knowledge" — `PLANNED`

**Objective.** Snapshots gain events near T, active wars, recent treaties, births/deaths, discoveries — the full doc 00 §5.3 promise for covered eras.
**Requirements.** Event/person composition into snapshot cells; importance-driven inclusion with "show more" pagination; near-T windowing rules per resolution (a year-bucket shows that year's events; a century-bucket shows the century's landmark events).
**Acceptance.** 1848 snapshot: revolutions, leaders, births/deaths render with citations within budget; century-resolution snapshot (e.g., 9th c.) degrades honestly.
**DB.** Snapshot evolution. **API.** v3 shape (additive). **Frontend.** Panel event cards + "this year/century" feed.
**Testing.** Fixture-date content assertions; perf gates.
**Docs.** Snapshot content spec v3.
**Depends on.** P42, P44. **Risks.** Panel overload — disclosure design reviewed with users.
**Future.** "This day in history" widgets (iOS) reuse windowing.
**Estimate.** 2 weeks.

### Phase 48 — Search v2: OpenSearch, time-aware & historical names — `PLANNED`

**Objective.** Swap search internals to OpenSearch (ADR-007): all entity kinds, alternate/historical names, transliterations, era-aware ranking, date parsing, filters.
**Requirements.** Index pipeline from event bus (rebuildable); analyzers for transliteration/diacritics; time-aware ranking (T-context boosts, "in other eras" section); relevance suite from P23 extended (Constantinople cases); zero-downtime index rebuilds.
**Acceptance.** Relevance suite green incl. historical-name cases; p95 <150ms; index rebuild from canon verified; P23 interface unchanged for clients.
**DB.** — **API.** `search` v2 (additive filters). **Frontend.** Filters + era sections in omnisearch.
**Testing.** Relevance fixtures; rebuild tests; load tests.
**Docs.** Search architecture doc.
**Depends on.** P23, P42, P44. **Risks.** Ranking tuning is endless — relevance suite defines "good enough" per release.
**Future.** NL questions P49.
**Estimate.** 2.5 weeks.

### Phase 49 — Natural-language questions & cause/consequence chains — `PLANNED`

**Objective.** "Who ruled France during the American Revolution?" — NL question answering via retrieval over canonical assertions with cited, linked answers and an abstain path (doc 08 §5); plus cause→consequence chain rendering from graph causality edges.
**Requirements.** Question → temporal+entity intent parsing (LLM-assisted, provider-abstracted per ADR-014) → canonical query plans → answer cards citing assertions; abstention when canon lacks data; causality chains UI on event pages (disputed-by-default styling per doc 07 §1.1).
**Acceptance.** Curated 100-question eval set: ≥90% correct-or-abstain, 0 fabrications (fabrication = any uncited claim — automated check); chains render for fixture wars.
**DB.** — **API.** `ask(q)` returning structured cited answers. **Frontend.** Answer cards in search; chain UI.
**Testing.** The eval set runs in CI against a pinned model config; abstention tests.
**Docs.** NL answering policy + eval methodology.
**Depends on.** P44, P48; ai-assist scaffolding minimal (full foundation P82 — this phase builds the retrieval harness it will reuse).
**Risks.** Hallucination — the structural answer is citations-or-abstain, enforced in the response schema.
**Future.** Full AI-assist foundation (P82) absorbs this harness.
**Estimate.** 2.5 weeks.

### Phase 50 — SSR public pages & share surfaces — `PLANNED`

**Objective.** Server-rendered entity pages and share cards (ADR-010 split): SEO, social embeds, and the permalink discipline (every view shareable).
**Requirements.** SSR layer over the same GraphQL persisted queries; OG/social cards (map thumbnail at T!); sitemaps; canonical URLs incl. `?at=`; cache strategy with watermark-based invalidation.
**Acceptance.** Entity pages render without JS (progressively enhance into the SPA); share card for "France in 1812" shows the 1812 map thumbnail; Core Web Vitals green.
**DB.** — **API.** — **Frontend.** SSR app + share-card renderer.
**Testing.** SSR/SPA parity tests; CWV budget in CI.
**Docs.** Rendering architecture notes.
**Depends on.** P35, P45, P46, P47. **Risks.** Dual-render drift — shared components + parity tests.
**Future.** iOS universal links (P72) target these URLs.
**Estimate.** 2 weeks.

### Phase 51 — Epoch 4 review & vocabulary governance console v0 — `PLANNED`

**Objective.** Audit; plus the first internal governance tool: relationship/kind vocabulary console (view, propose, approve via curation path) — pre-figuring Epoch 7 admin patterns.
**Requirements.** Vocabulary console (internal roles only); review per standing template (docs, changelog, roadmap, budgets, fixtures — add "Vienna 1815" known world); Epoch 5 re-scope.
**Acceptance.** Vocabulary change flows propose→review→commit with history; review report merged; phases DONE-stamped.
**Depends on.** P39–P50. **Estimate.** 1.5 weeks.

---

**Epoch 4 total: ~27 weeks (≈6 months).**
