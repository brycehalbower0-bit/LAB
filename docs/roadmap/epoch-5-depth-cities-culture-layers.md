# Epoch 5 — Depth: Cities, Culture & Layers (Phases 52–63)

**Theme:** breadth of time and richness of place — deep history arrives (honestly
coarse), cities become dossiers, and the thematic layer system (religion, language,
population, trade, conflict, climate, colonial) makes the map a research
instrument. Exit state: explore antiquity to today with combinable layers.

---

### Phase 52 — City depth: populations & ownership chains — `PLANNED`
**Objective.** Cities through time: population estimates (ranged, sourced: Reba et al., HYDE-derived), political ownership chains (which polity, when — derived + curated), settlement status changes (founded, destroyed, renamed, refounded).
**Requirements.** `gazetteer.population_estimate` (value+range+method); ownership chain read model derived from border claims ∩ city point + explicit override assertions (conquests between border snapshots); Reba/HYDE ingestion pipelines.
**Acceptance.** Rome, Constantinople/İstanbul, Paris fixtures: population curves with ranges and ownership chains correct at sampled dates; derived-vs-explicit provenance distinguishable.
**DB.** Population/ownership tables. **API.** City history queries. **Frontend.** —
**Testing.** Derivation-logic tests (border∩point edge cases); pipeline golden files.
**Docs.** City modeling guide; estimate-methodology notes.
**Depends on.** Epoch 4 complete. **Risks.** Derived ownership wrong at war boundaries — explicit assertions win by design.
**Future.** City pages P53; population layer P60.
**Estimate.** 2.5 weeks.

### Phase 53 — City pages v1 — `PLANNED`
**Objective.** The city dossier (doc 06 §3): founding, names, population curve, ownership ribbon, events-here, buildings/landmarks, transport links, media galleries, historic-map slots.
**Requirements.** City panels on dossier system; population chart (range bands rendered); ownership ribbon coupled to global T; "events near here" from event geometry; landmark sub-entities (minimal: dated place-kind).
**Acceptance.** Showcase cities (Rome, Istanbul, Paris, London, Beijing, Mexico City) render rich, cited dossiers; every panel links onward.
**DB.** Landmark modeling (light). **API.** City page query. **Frontend.** City dossier.
**Testing.** E2E; chart component tests (ranges!).
**Docs.** Updates.
**Depends on.** P52. **Risks.** Depth unevenness across cities — acceptable; coverage dashboards make it visible.
**Future.** Georeferenced historic map overlays (deferred candidate, revisit at P63).
**Estimate.** 2 weeks.

### Phase 54 — Deep-time coarse world: antiquity to 1815 — `PLANNED`
**Objective.** Extend the political world to deep history at *honest* resolution: Historical Basemaps seed (heavily curated), Pleiades places, Seshat polity attributes; era/century buckets pre-1500, decade where supported 1500–1815.
**Requirements.** License-verified ingestion of seeds; certainty defaults `approximate`/`conjectural`; frontier-zone modeling for steppe/pre-modern polities; change-event register extended to major transitions (curated landmark dates); prioritized deepening: Mediterranean 500 BCE–500 CE showcase region to decade/year-grade where scholarship supports.
**Acceptance.** Timeline scrubs continuously from ~3000 BCE to today with no empty world; Roman-era Mediterranean is showcase-grade; certainty rendering audited (no false crispness — doc 00 §6 compliance review recorded).
**DB.** Data + era-bucket configs. **API/Frontend.** Timeline gains deep-time ranges + era quantization already built (P19).
**Testing.** Continuity checks epoch-wide; Mediterranean fixture assertions.
**Docs.** Deep-time methodology (uncertainty doctrine in practice).
**Depends on.** P31, P33 machinery. **Risks.** Largest honesty test in the project; the methodology doc and historian review are the guardrails. Curation-heavy.
**Estimate.** 4 weeks.

### Phase 55 — Ancient-era snapshots & uncertainty UX audit — `PLANNED`
**Objective.** Snapshot composition for era/century buckets (landmark events, major polities, culture highlights) and a full uncertainty-UX pass across instrument, panels, pages for deep time.
**Requirements.** Century/era snapshot windowing (P47 rules extended); resolution badges + "why is this fuzzy?" explainer surface; conjectural-border styling finalized with design review; date rendering audit (no fake precision anywhere — automated formatter check + manual audit).
**Acceptance.** 117 CE snapshot briefs Rome/Parthia/Han correctly at century honesty; uncertainty explainer user-tested; audit findings fixed.
**DB.** — **API.** Snapshot era shapes. **Frontend.** Uncertainty UX components.
**Testing.** "Mediterranean 117 CE" known world locked (moved up from P63 if ready).
**Docs.** Uncertainty rendering guide (design-system addition).
**Depends on.** P54. **Risks.** Subtle UX — allocate design iterations.
**Future.** All later layers inherit the uncertainty kit.
**Estimate.** 2 weeks.

### Phase 56 — Culture module: languages & religions — `PLANNED`
**Objective.** Language and religion entities (Glottolog-seeded; religion taxonomy governed) with dated distribution assertions (region-level polygons/associations, honest coarse).
**Requirements.** `culture.*` tables (entity + distribution assertions referencing geometry versions); Glottolog pipeline; religion taxonomy with editorial policy (sensitive — doc 08 §1 neutrality rules apply); polity/place associations (official language, state religion as assertions).
**Acceptance.** Fixture distributions (Latin/Romance evolution coarse; Christianity/Islam spread century-grade) stored and queryable at-T with citations.
**DB.** Culture schema. **API.** Culture queries + polity/place culture panels. **Frontend.** Panels on dossiers.
**Testing.** At-T distribution tests.
**Docs.** Culture modeling guide + sensitivity policy.
**Depends on.** P54. **Risks.** Contested categorizations — parallel assertions + policy, never silent adjudication.
**Future.** Layers P57; inventions/ideas later epoch candidate.
**Estimate.** 2 weeks.

### Phase 57 — Religion & language map layers — `PLANNED`
**Objective.** First thematic layers on the tile machinery: religion and language distributions through time, combinable with political (doc 06 §2).
**Requirements.** Layer definitions in atlas module (resolution declarations, legends, opacity); tile builds from culture distributions; layer-combination rendering rules (blend modes, conflict with political fills); layer tray v2 (groups, legends, per-layer time-support labels).
**Acceptance.** Religion layer 600→1500 renders correctly at century steps combined with political layer; legends accurate; budgets hold.
**DB.** Layer config tables. **API.** Manifest lists thematic layers. **Frontend.** Layer tray v2 + legends.
**Testing.** Tile golden tests; combination visual regression.
**Docs.** Layer authoring guide (template for all future layers).
**Depends on.** P31, P56. **Risks.** Cartographic legibility when combining — design review gate.
**Future.** Every subsequent layer follows this template.
**Estimate.** 2 weeks.

### Phase 58 — Trade routes & transport layer — `PLANNED`
**Objective.** Dated route networks (Silk Road, maritime routes, Roman roads, rail arrival) as line features with flow semantics.
**Requirements.** Route modeling (line geometry versions + dated route assertions + goods/usage attributes); curated seed data (documented sources; OSM-derived where licensing permits for modern rail); deck.gl flow styling (animated optional, reduced-motion honored).
**Acceptance.** Silk Road at 750 CE and rail expansion 1840–1900 render era-correctly with citations; route entities have pages (dossier reuse).
**DB.** Route tables. **API.** Layer + route pages. **Frontend.** Flow rendering.
**Testing.** Layer goldens; route page E2E.
**Docs.** Route modeling notes.
**Depends on.** P57 template. **Risks.** Data scarcity — curated landmark networks first, no invented precision.
**Future.** Migration flows reuse flow rendering (deferred to backlog if P61 crowds it).
**Estimate.** 2 weeks.

### Phase 59 — Conflict layer — `PLANNED`
**Objective.** Wars on the map: battle markers at T, war-zone areas, front lines where sourced (WWI/WWII western fronts as showcase), siege markers.
**Requirements.** Conflict layer from event geometries + war-phase areas; front-line geometry model (dated line versions per war phase) for wars with sourced fronts; timeline-coupled animation within wars (scrub a war week-by-week where data supports).
**Acceptance.** 1914–1918 western front scrubs monthly with citations; Napoleonic battles marker-correct at year grain; no fronts rendered where none are sourced.
**DB.** Front-line tables. **API.** Layer + war-page map upgrades. **Frontend.** Conflict styling + war scrub.
**Testing.** Goldens; war-page E2E.
**Docs.** Conflict cartography notes.
**Depends on.** P41, P45, P57. **Risks.** Front data labor — showcase wars only, honestly.
**Future.** Community contributions (Epoch 7) can extend fronts.
**Estimate.** 2 weeks.

### Phase 60 — Population density layer — `PLANNED`
**Objective.** HYDE-based population density through time (10,000 BCE→present) as a raster-derived layer; city-size symbolization tied to population estimates.
**Requirements.** Raster pipeline (HYDE grids → COG → raster tiles, ADR-004 revisit note executed); city marker sizing from P52 estimates at T; layer legend with methodology link.
**Acceptance.** Density layer scrubs sensibly across millennia; city sizes change with T; methodology page cited.
**DB.** Raster catalog tables. **API.** Raster tile endpoints in manifest. **Frontend.** Raster layer support in instrument.
**Testing.** Raster pipeline tests; visual checkpoints.
**Docs.** Raster layer pipeline doc.
**Depends on.** P52, P57. **Risks.** Raster infra is new machinery — timebox, reuse for climate next.
**Future.** Climate layers (P61) reuse everything.
**Estimate.** 2 weeks.

### Phase 61 — Climate & biome layers — `PLANNED`
**Objective.** Paleoclimate/biome reconstructions as scrubbing raster layers (ice ages visible!), with strong scientific-provenance labeling.
**Requirements.** PaleoClim/reconstruction ingestion (license-verified); era-appropriate availability declarations; "model reconstruction" labeling distinct from historical assertion (these are *scientific model* sources — reliability metadata extended).
**Acceptance.** Scrub 20,000 BCE→today showing ice-sheet/biome change with correct source labels; layer honesty reviewed.
**DB.** Data + source classes. **API/Frontend.** Layer additions.
**Testing.** Pipeline tests; visual checkpoints.
**Docs.** Scientific-layer policy addendum.
**Depends on.** P60 machinery. **Risks.** Low (machinery exists); scope-creep into climate science — presentation only.
**Future.** Sea-level/coastline change is a hard problem — explicitly deferred with notes.
**Estimate.** 1.5 weeks.

### Phase 62 — Colonial view & administrative divisions layer — `PLANNED`
**Objective.** Imperial/colonial perspective (metropole-colored world with claim honesty) and historical admin-division layers where sourced (national HGIS integrations begin: one showcase country).
**Requirements.** Colonial styling mode over claim_kind data (de jure claims vs de facto control visible); admin-division dated ingestion for showcase (e.g., US historical counties — license-verified); layer interactions with political base.
**Acceptance.** 1898 colonial view renders empires honestly (claims vs control distinguishable); showcase country's internal divisions scrub correctly.
**DB.** Admin-division data. **API/Frontend.** Layer + styling mode.
**Testing.** Goldens; claim/control fixture assertions.
**Docs.** Colonial-view policy notes (sensitive framing reviewed).
**Depends on.** P33, P57. **Risks.** Framing sensitivity — editorial policy review is part of acceptance.
**Future.** More national HGIS integrations as ongoing curation.
**Estimate.** 2 weeks.

### Phase 63 — Epoch 5 review & known worlds expansion — `PLANNED`
**Objective.** Audit; lock "Mediterranean 117 CE" (if not at P55) and "World 1500" known worlds; layer-system performance pass; deepening-priority queue refreshed (doc 04 §5).
**Acceptance.** Fixtures gate CI; budgets green with 3+ layers combined; review report merged; Epoch 6 confirmed/re-scoped; phases DONE-stamped.
**Depends on.** P52–P62. **Estimate.** 1.5 weeks.

---

**Epoch 5 total: ~26 weeks (≈6 months).**
