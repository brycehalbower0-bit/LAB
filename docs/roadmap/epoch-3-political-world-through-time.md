# Epoch 3 — Political World Through Time (Phases 26–38)

**Theme:** the signature capability — scrub the timeline and watch borders change.
Scope discipline: the statehood era (1815→present) reaches year resolution first;
deep time arrives (coarsely) in Epoch 5. Exit state: timeline-driven political map
1815→today, country pages with leader/capital timelines, honest uncertainty
rendering.

---

### Phase 26 — Polity module: existence & government — `PLANNED`

**Objective.** The `polity` module core: polity entities, dated existence assertions (sovereign/vassal/colony/occupied…), government forms.
**Requirements.** Polity detail + `polity.existence` + `polity.government_form` assertion tables; succession relations (`successor_of`) groundwork; primacy rules for overlapping existence claims; polity kinds vocabulary (governed enum).
**Acceptance.** Model tricky fixtures correctly: German unification chain, Austria-Hungary, USSR dissolution — existence-at-T answers correct for each year.
**DB.** `polity.*` core tables. **API.** `polity(id)` v1. **Frontend.** —
**Testing.** Fixture-driven at-T tests (these become permanent).
**Docs.** Polity modeling guide (the subtlest domain doc — written with historian review).
**Depends on.** Epoch 2 complete. **Risks.** Ontology arguments; the modeling guide decides, ADR-style, and moves on.
**Future.** Border claims P29; pages P35.
**Estimate.** 2 weeks.

### Phase 27 — Leadership, offices & capitals — `PLANNED`

**Objective.** Offices (head of state/government, monarch styles), leaders-in-office assertions (person references stubbed until Epoch 4 person module — registry entities suffice), capital assertions.
**Requirements.** `polity.office`, `polity.leadership`, `polity.capital` assertion tables; office succession chains; capital-move modeling (dated, sourced); consistency checks (leadership within polity existence — flag, don't block, doc 04 §7).
**Acceptance.** France 1780–1900 fixture: correct leader and capital for any date incl. revolutionary churn; integrity checker flags seeded contradictions.
**DB.** Above tables. **API.** Leaders/capitals on `polity` + at-T. **Frontend.** —
**Testing.** Succession/at-T unit tests; integrity-flag tests.
**Docs.** Module README updates.
**Depends on.** P26. **Risks.** Office ontology explosion — start with a minimal governed set.
**Future.** Person pages link both ways (Epoch 4).
**Estimate.** 1.5 weeks.

### Phase 28 — Wikidata seed: polities, leaders, capitals — `PLANNED`

**Objective.** First knowledge-scale ingestion: Wikidata-backed polity/leadership/capital assertions for the statehood era, through reconciliation and bulk-proposal review.
**Requirements.** Wikidata pipeline (SPARQL/dumps) scoped to sovereign states 1815→present + offices + officeholders + capitals; reliability-class B citations (referenced statements) vs C (unreferenced) per doc 04 §6; reconciliation via QIDs; batch proposals sized for review.
**Acceptance.** ≥95% of 1815→present sovereign polities present with existence, ≥90% with leader chains and capitals; every assertion cites Wikidata + statement provenance; import reversible as revisions.
**DB.** — **API.** — **Frontend.** —
**Testing.** Pipeline golden files; sampled human spot-check protocol (documented, results recorded).
**Docs.** Wikidata runbook incl. known data-quality traps.
**Depends on.** P16, P26, P27. **Risks.** Wikidata inconsistency — spot-check protocol + confidence ceilings, not blind trust.
**Future.** Events/people seeds (P42) reuse this pipeline.
**Estimate.** 2.5 weeks.

### Phase 29 — Border claims model & certainty classes — `PLANNED`

**Objective.** `polity.border_claim` per doc 03 §5: geometry versions + validity + certainty class + claim kind; overlapping/disputed support.
**Requirements.** Assertion table + certainty/claim-kind enums; integrity checks (claims within existence; neighbor sliver detection); at-T border resolution service (primacy + claim-kind selection rules for the political layer, spec'd with the atlas module).
**Acceptance.** Fixtures: a dispute (two overlapping de-facto/claimed), a frontier zone, a conjectural boundary — all storable, queryable at-T, and typed for rendering.
**DB.** `polity.border_claim`. **API.** Borders-at-T (internal, feeds tiles). **Frontend.** —
**Testing.** Overlap semantics property tests; sliver-detection tests.
**Docs.** Border modeling guide (+naming/dispute policy cross-ref, doc 08 §1).
**Depends on.** P14, P26. **Risks.** Rendering-rule ambiguity — the resolution spec is the deliverable as much as the table.
**Future.** Fed by P30/P33 data; edited by P79 admin tools; proposed-to by P85 public flow.
**Estimate.** 2 weeks.

### Phase 30 — Statehood-era borders (1886→present) — `PLANNED`

**Objective.** Year-resolution world political geometry 1886→present: independently curated, validated against CShapes as reference (license gate: reference-only, doc 04 §1.2).
**Requirements.** Build geometry from redistributable sources (Natural Earth backbone + documented curated edits per boundary change event); change-event register (treaty/war/independence → border delta, each cited); CShapes comparison harness producing divergence reports (never copying geometry); certainty classes assigned honestly.
**Acceptance.** Every year 1886→present renders a complete world political map; divergence-vs-reference report reviewed and dispositioned; every border delta traces to a cited change event.
**DB.** Data (revisions). **API.** — **Frontend.** —
**Testing.** Continuity checks (no polity flicker between years without a change event); comparison harness in CI for touched regions.
**Docs.** Border curation methodology (the document historians will judge us by).
**Depends on.** P28, P29. **Risks.** The heaviest curation lift in the plan; scope guard: world coverage at honest certainty, not cartographic perfection everywhere.
**Future.** 1815–1886 next (P33); community help arrives Epoch 7.
**Estimate.** 4 weeks (curation-heavy; overlaps engineering idle time poorly — schedule honestly).

### Phase 31 — Time-parameterized tiles (the product's heart) — `PLANNED`

**Objective.** Political-layer tiles per time bucket with build orchestration, manifest resolution `at → bucket URLs`, and precise invalidation (docs 03 §7, 05 §3.2).
**Requirements.** Bucket scheme per layer/era resolution; prebuilt tilesets for stable buckets (batch builds to object storage/CDN), dynamic rendering for churning buckets; `entity.changed` → affected-bucket computation → rebuild queue; feature props: `entityId`, `certainty`, `claimKind`.
**Acceptance.** Manifest for any 1886→present date returns tiles meeting perf budgets; editing an 1890s border via curation rebuilds only affected buckets/cells (measured); CDN behavior verified.
**DB.** Build/bucket bookkeeping tables. **API.** Manifest v2. **Frontend.** —
**Testing.** Invalidation-precision tests; tile golden tests per bucket; load tests.
**Docs.** Tile pipeline deep-dive (permanent reference).
**Depends on.** P17, P29, P30. **Risks.** Bucket-space explosion — resolution-honest bucketing (decade buckets where data is decade-grade) is the control.
**Future.** All thematic layers (Epoch 5) ride this machinery.
**Estimate.** 3 weeks.

### Phase 32 — Living scrub: map×timeline coupling & play mode — `PLANNED`

**Objective.** The signature interaction: scrub 1815→today (data permitting per P30/33 progress) with morphing borders, appearing cities, resolution badge, and animated play (doc 06 §1 rules 3–6).
**Requirements.** Client tile-bucket prefetch + crossfade strategy; store-driven T propagation within 100ms perceived; resolution badge + quantization UX; play mode (era-aware speed); reduced-motion path (cuts).
**Acceptance.** Scrubbing a century feels continuous on target hardware (user-tested); play mode demo "Europe 1815→1914" is smooth and honest; E2E perf assertions in CI.
**DB.** — **API.** Prefetch hints on manifest. **Frontend.** The scrub experience.
**Testing.** Frame-budget instrumentation tests; E2E scrub scenarios.
**Docs.** Interaction spec finalized (iOS parity reference).
**Depends on.** P19, P31. **Risks.** This is the demo that defines the product — allocate polish iterations.
**Future.** iOS variant P73.
**Estimate.** 2.5 weeks.

### Phase 33 — 1815–1886 borders (curated deepening #1) — `PLANNED`

**Objective.** Extend year-resolution political history back to the Congress of Vienna, prioritizing Europe/Americas where sources are dense; honest coarser certainty elsewhere.
**Requirements.** Same methodology as P30 (change-event register, cited deltas); colonial claims modeled with `claim_kind` honesty; prioritization per doc 04 §5.
**Acceptance.** Continuous world map 1815→present; Europe/Americas year-grade; elsewhere decade-grade with visible certainty classes; historian review pass on Europe recorded.
**DB.** Data. **API/Frontend.** —
**Testing.** Continuity + known-event spot checks (1830, 1848, 1861, 1871…).
**Docs.** Methodology addenda per region.
**Depends on.** P30, P31. **Risks.** Same as P30.
**Future.** Pre-1815 in Epoch 5 at coarser honest resolution.
**Estimate.** 3.5 weeks.

### Phase 34 — World snapshot v2: political content — `PLANNED`

**Objective.** Snapshots across 1815→present: polities with governments, leaders, capitals, certainty — the context panel becomes a real "world at T" briefing.
**Requirements.** Snapshot composition extended to polity module; importance-based inclusion cutoffs (interim heuristic until P44); per-era bucket resolution; panel cards (polity list, leaders, capitals) with citations.
**Acceptance.** Any date 1815→present: correct polity roster + leaders/capitals with sources; budgets hold; invalidation from border/leader edits verified.
**DB.** Snapshot schema evolution. **API.** `worldSnapshot` v2. **Frontend.** Panel political cards.
**Testing.** Fixture dates cross-checked against reference chronologies (documented sample protocol).
**Docs.** Snapshot content spec per layer.
**Depends on.** P28, P31. **Risks.** Panel information overload — importance cutoffs + progressive disclosure.
**Future.** Events/births/deaths (P47).
**Estimate.** 2 weeks.

### Phase 35 — Country/polity pages v1 — `PLANNED`

**Objective.** The polity dossier (doc 06 §3): overview-at-T, existence timeline, leader timeline, capital timeline, government history, territory evolution strip (small-multiple maps), wars/treaties placeholders.
**Requirements.** Dossier system (P22) extended with polity panels; territory small-multiples rendered from bucket tiles; succession navigation (predecessor/successor polities); quiz/contribute affordances stubbed.
**Acceptance.** France, Prussia/Germany, Ottoman Empire pages render complete, cited, navigable dossiers; territory strip matches map truth; a11y ≥95.
**DB.** — **API.** Polity page persisted query. **Frontend.** Polity dossier.
**Testing.** E2E page journeys; visual regression on territory strips.
**Docs.** Page architecture updates.
**Depends on.** P27, P31, P34. **Risks.** Page perf with many timelines — persisted query shaping + pagination.
**Future.** Flags/currency (P36), events/wars (Epoch 4), quizzes (Epoch 6).
**Estimate.** 2 weeks.

### Phase 36 — Flags, currencies & name-at-T rendering — `PLANNED`

**Objective.** Flag history (dated flag assertions + media), currency-in-use assertions, and name-at-T rendering everywhere (map labels, pages, search results honor T).
**Requirements.** `polity.flag` (media-linked, dated), `polity.currency_use`; label pipeline uses name-at-T (Constantinople pre-1930 at label level); flag timeline UI on polity pages.
**Acceptance.** Scrubbing renames labels correctly for fixture cases (Constantinople/İstanbul, St. Petersburg/Petrograd/Leningrad); flag timelines render with sources; currency panel cited.
**DB.** Flag/currency tables. **API.** Exposure on polity/place. **Frontend.** Flag timeline; label behavior.
**Testing.** Name-at-T fixtures; label snapshot tests.
**Docs.** Naming policy operationalization notes.
**Depends on.** P24, P35. **Risks.** Label churn perf — bucket labels with tiles.
**Future.** Flag quizzes (Epoch 6) get era-aware for free.
**Estimate.** 1.5 weeks.

### Phase 37 — Temporal integrity suite v1 & known worlds (Europe 1848/1938) — `PLANNED`

**Objective.** Codify doc 04 §7 checks as a continuously-running suite; lock two politically-rich known worlds as golden fixtures.
**Requirements.** Integrity checks (existence overlap, leadership/capital containment, border-era intersection, continuity) as CI-on-fixtures + nightly-on-production jobs with dashboards; "Europe 1848", "World 1938" fixtures (snapshot+tiles+pages).
**Acceptance.** Seeded violations detected; nightly report clean or triaged; fixtures gate CI.
**DB.** Check bookkeeping. **API.** — **Frontend.** —
**Testing.** The suite itself + meta-tests.
**Docs.** Integrity check catalog (versioned, doc 04 §7 cross-ref).
**Depends on.** P30–P36. **Risks.** Alert fatigue — severity tiers from day one.
**Future.** Every module adds checks; the AI gate (P83) reuses them.
**Estimate.** 1.5 weeks.

### Phase 38 — Epoch 3 review & scrub performance hardening — `PLANNED`

**Objective.** Architecture audit; make the signature scrub bulletproof (perf, cache hit rates, cold paths); re-scope Epoch 4.
**Requirements.** Perf pass against budgets under load (tiles, snapshot, manifest); cache-hit dashboards; docs/CHANGELOG/roadmap updates; public-demo-quality staging build ("Europe 1815–1914" tour of capability); user tests recorded.
**Acceptance.** Budgets green under load test; review report merged; Epoch 4 confirmed/revised; all phases DONE-stamped.
**Depends on.** P26–P37. **Estimate.** 1.5 weeks.

---

**Epoch 3 total: ~30 weeks (≈7 months).**
