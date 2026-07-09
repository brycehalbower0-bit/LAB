# 04 — Data Acquisition & Provenance

**Status:** Normative · **Owner:** GIS Engineer / Data Lead · **Last updated:** 2026-07-09

Chronos will eventually hold millions of records spanning most of recorded history.
Nearly all of it enters through pipelines from existing datasets, then improves
through curation. This document defines the source landscape, licensing gates,
pipeline architecture, and the provenance/confidence model that makes every data
point traceable.

---

## 1. Source Landscape (initial registry)

Every source below gets a registry entry (a `source` entity) before any ingestion.
Licenses must be re-verified at ingestion time — this table is the planning view.

### 1.1 Modern geography (the base of the stack)

| Dataset          | Content                                                               | License (verify)  | Role                                                   |
| ---------------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| Natural Earth    | Modern countries, admin-1, cities, physical features, multiple scales | Public domain     | Base political/physical vectors; style development     |
| OpenStreetMap    | Everything modern, high detail                                        | ODbL              | Modern detail layers (attribution + share-alike gates) |
| geoBoundaries    | Modern admin boundaries, versioned                                    | CC BY 4.0         | Admin divisions                                        |
| GeoNames         | Place names, hierarchy, coordinates                                   | CC BY 4.0         | Gazetteer seeding, alternate names                     |
| SRTM/GEBCO/ETOPO | Terrain & bathymetry                                                  | Public domain-ish | Terrain/physical basemap                               |

### 1.2 Historical borders & polities (the hard part)

| Dataset                                                                                                 | Content                                            | License (verify)                                                                                   | Role                                                        |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| CShapes 2.0                                                                                             | State borders & capitals 1886–2019, yearly         | CC BY-NC-SA (research) — **license gate: likely reference-only; verify before any redistribution** | Gold standard for the statehood era                         |
| Historical Basemaps (aourednik)                                                                         | World political borders ~123,000 BCE–2010 (coarse) | GPL/CC — verify per file                                                                           | Seed for pre-1886 world coverage; heavily curated afterward |
| Euratlas                                                                                                | Europe political maps 1–2000 CE, century steps     | **Commercial**                                                                                     | Candidate licensed acquisition for European accuracy        |
| Pleiades                                                                                                | Ancient Mediterranean places                       | CC BY                                                                                              | Ancient gazetteer backbone                                  |
| World Historical Gazetteer                                                                              | Cross-period place linkage                         | CC BY                                                                                              | Entity reconciliation across periods                        |
| Seshat / D-PLACE                                                                                        | Polity characteristics, social complexity          | CC BY(-SA) variants                                                                                | Polity attributes, government forms                         |
| OpenHistoricalMap                                                                                       | Crowd-sourced historical features                  | ODbL-like                                                                                          | Growing detail source; also a community ally                |
| National HGIS projects (e.g., China CHGIS, US Atlas of Historical County Boundaries, Vision of Britain) | Deep regional admin history                        | Varies                                                                                             | Regional deep-dives in later epochs                         |

### 1.3 Entities, events, people, culture

| Dataset                                                                  | Content                                                           | License                                   | Role                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Wikidata                                                                 | Entities, dates, relationships, external IDs, multilingual labels | CC0                                       | Primary graph seed: polities, people, events, offices, cities |
| Wikipedia / DBpedia                                                      | Narrative text, infoboxes                                         | CC BY-SA                                  | Summaries (attributed), link mining — never blind copy        |
| Wikimedia Commons                                                        | Historical maps, photos, flags                                    | Varies per file                           | Media library with per-item license records                   |
| Pantheon (MIT)                                                           | Notable people, fame metrics                                      | CC BY                                     | Person seeding, importance scoring input                      |
| Correlates of War / UCDP                                                 | Wars, participants, casualties (1816+ / 1946+)                    | Free for research — verify redistribution | War/battle data for modern era                                |
| Ruler/leader compilations (e.g., Rulers.org-style, Wikidata `P6` chains) | Heads of state/government                                         | Varies; Wikidata preferred                | Leadership timelines                                          |
| HYDE 3.x                                                                 | Gridded historical population/land use 10,000 BCE–present         | CC BY                                     | Population layers & estimates                                 |
| Reba–Reitsma–Seto historical urban population                            | City populations 3700 BCE–2000 CE                                 | CC BY                                     | City population curves                                        |
| Maddison Project                                                         | Historical GDP/economy                                            | CC BY                                     | Economic layers                                               |
| Glottolog / Ethnologue-alternatives                                      | Languages                                                         | CC BY (Glottolog)                         | Language entities & distribution                              |
| PaleoClim / paleoclimate reconstructions                                 | Climate layers                                                    | Varies                                    | Climate/biome layers (raster)                                 |

### 1.4 Explicitly rejected until licensed

GeaCron, commercial atlas scans, Britannica text, Ethnologue data — attractive but
license-incompatible. The registry records rejections too, so future contributors
don't re-litigate.

## 2. Acquisition Strategy (order of operations)

The roadmap (Epochs 2–5) sequences ingestion to maximize coherence:

1. **Modern baseline first** (Natural Earth + geoBoundaries + GeoNames): a complete,
   correct _today_ — the reference frame every historical layer diffs against.
2. **Statehood era backward** (CShapes-informed 1886–present, then 1815–1886
   curated): yearly resolution where sources support it.
3. **Wikidata graph seed**: polities, people, events, offices with dates and
   cross-references — the knowledge graph skeleton across all periods.
4. **Deep history coarse pass** (Historical Basemaps + Pleiades + Seshat):
   era/century resolution, honest `conjectural`/`approximate` certainty everywhere.
5. **Regional deepening forever after**: prioritized region-period cells (see §5)
   raised to higher resolution one at a time with specialist sources.

**Principle: global schema, incremental depth.** Coverage is never blocked on
precision; precision is never faked to claim coverage.

## 3. Pipeline Architecture (`/pipelines`, Python)

```
 fetch → normalize → reconcile → validate → stage → propose → (curation review) → canonical
```

- **fetch**: versioned raw drops into object storage (`/raw/{source}/{version}/…`);
  checksums recorded; original never modified. Re-runnable.
- **normalize**: to Chronos shapes — entities, assertions, HistoricalDates,
  geometries (EPSG:4326, validity-fixed, simplification variants generated).
- **reconcile**: entity resolution against existing registry via external IDs
  first (Wikidata QID, GeoNames), then name+time+space matching with scored
  candidates; ambiguous matches → human reconciliation queue, never auto-merge.
- **validate**: schema, temporal sanity (no negative intervals; precision honesty),
  geometry validity, license gate, citation completeness. Hard failures stop the
  batch; soft warnings annotate it.
- **stage → propose**: batches become **proposed revisions** in `curation` — every
  import is reviewable, attributable, and reversible as a unit (doc 03 §8). No
  pipeline ever writes canonical tables directly.

Pipelines are: idempotent (re-running a version is a no-op), incremental
(diff-aware for updated sources), tested (golden-file tests per source), and
documented (a runbook per source).

## 4. Licensing & Compliance Gates

- The **source registry** records: license, license-verified-date, attribution
  text, share-alike obligations, redistribution rights, and an allowed-use flag
  (`canonical | reference_only | display_only | rejected`).
- Ingestion **refuses** sources whose registry entry isn't verified.
- ODbL (OSM) share-alike: OSM-derived layers are kept in isolated, clearly
  attributed layer products; canonical Chronos assertions built on OSM geometry
  are tracked so derivative-database obligations can be honored.
- NC-licensed datasets (e.g., CShapes redistribution limits) are treated as
  **reference implementations**: we may validate our independently-curated borders
  against them, but not redistribute their geometry — the registry flag enforces
  which pipelines may feed canonical tables.
- Every public page renders the attribution stack for the data it displays
  (assembled from citations — no manual attribution lists).

## 5. Prioritization Model (what gets deepened first)

Region-period cells are scored by: learner demand (curriculum relevance),
source availability, current coverage gap, and connective value (how many
high-importance events/people/polities the cell unlocks). The prioritization
queue is a living admin artifact (Epoch 7 tooling); early hard-coded priorities:

1. Modern world (complete)
2. Europe & Mediterranean 1789–1945 (dense sources, high demand)
3. Roman world 500 BCE–500 CE (Pleiades-backed showcase for deep time)
4. Statehood-era world 1886–present (CShapes-validated)
5. Colonial world & trade routes 1500–1900

## 6. Provenance & Confidence Model

Every assertion carries citations (doc 03 §4); every citation names a source
entity; every source entity records reliability class:

| Class                         | Examples                                                      | Default confidence ceiling               |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| A — scholarly/primary-derived | Academic HGIS, peer-reviewed compilations, treaties           | 100                                      |
| B — curated tertiary          | Wikidata (referenced statements), national statistical series | 85                                       |
| C — community/crowd           | OSM, OpenHistoricalMap, unreferenced Wikidata                 | 70                                       |
| D — traditional/legendary     | Founding myths, traditional dates                             | stored as `interpretation='traditional'` |

Rules: an assertion's confidence starts at min(source ceilings) and moves only via
editorial review; conflicting sources create parallel assertions (never silent
averaging); derived values (e.g., interpolated population) cite their inputs _and_
method, flagged `method='derived'`.

## 7. Data Quality Doctrine

- **Temporal integrity checks** (continuous, in CI against fixtures and nightly
  against production): no polity with overlapping `primacy` existence assertions;
  no capital assertion outside its polity's existence; no leader in office outside
  their lifespan (flag, don't auto-delete — sometimes the _lifespan_ is wrong);
  border claims must intersect their polity's era.
- **Geometry checks**: validity, winding, no accidental slivers between neighbors
  beyond tolerance, generalization variants present.
- **Coverage dashboards** (admin): per region-period cell — % polities with
  borders, leaders, capitals; citation density; confidence distribution.
- Quality metrics are versioned so regressions from imports are visible per revision.
