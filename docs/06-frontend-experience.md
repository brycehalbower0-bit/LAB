# 06 — Frontend Experience (Web & iOS)

**Status:** Normative · **Owner:** UX Designer / Frontend Lead · **Last updated:** 2026-07-09

Chronos ships two first-class clients — the **web app** (reference client, ADR-010)
and the **native iOS app** (ADR-016) — over identical contracts. This document
specifies the experience architecture both must realize, then the per-platform
specifics.

---

## 1. The Instrument: Map + Timeline

The home screen of Chronos is a single instrument with three permanently coupled
parts:

```
┌──────────────────────────────────────────────────────────────┐
│  ⌕ search…                                    ◔ layers  👤   │
│                                                              │
│                                                              │
│                    THE MAP (full-bleed)                      │
│                                                              │
│                                  ┌───────────────────────┐   │
│                                  │ CONTEXT PANEL         │   │
│                                  │ world/selection @ T   │   │
│                                  │ (snapshot cards,      │   │
│                                  │  entity preview,      │   │
│                                  │  citations)           │   │
│                                  └───────────────────────┘   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  ◄◄    ─────────●────────────────────────────   ►►  ▶    │ │
│ │  3000 BCE      117 CE                          today     │ │
│ │  [era ▾]  zoomable, multi-resolution TIMELINE            │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Coupling rules (non-negotiable across platforms):**

1. Map, timeline, and panel always agree on T. Changing any one updates the others.
2. URL/state (`?at=1848&lat…&layers=political,religion`) fully encodes the view —
   every view is shareable and restorable (deep links on iOS).
3. Timeline zoom = temporal resolution: zoomed out you scrub centuries, zoomed in
   years/months — but never finer than the data supports for the visible region
   (the timeline visually "quantizes" in low-resolution periods and shows why).
4. Scrubbing is _alive_: borders morph (crossfade between adjacent time buckets),
   cities appear/fade, event markers pulse at their moments. Target: 60fps scrub
   with ≤100ms perceived tile-swap (doc 05 §7).
5. Uncertainty is rendered: frontier zones as gradients, conjectural borders
   dashed/desaturated, disputed areas hatched with both claimants' hues, and a
   resolution badge ("year view · 1848" / "century view · 8th c. BCE").
6. A **play** control animates time (adjustable speed, era-aware stepping) —
   the "watch empires rise and fall" moment is a core demo path.

## 2. Layers

Layer tray groups (each a toggle + opacity + legend; combinable): Political
(default), Administrative, Cities & settlements, Physical/terrain, Conflict
(fronts, battles), Religion, Language, Population density, Trade & transport
routes, Colonial/imperial view, Economy/resources, Climate & biomes, Migration
flows, Archaeology/culture sites, Custom overlays (user/curator authored, later).
Layers declare their supported period-resolution so the tray communicates honestly
("Religion layer: century resolution before 1500").

## 3. Entity Pages (the encyclopedia)

One page architecture for all kinds — a **temporal dossier**:

- **Header:** name-at-T (with all names timeline), kind, existence interval,
  hero map thumbnail (its geometry/location at T), confidence/provenance affordance.
- **Mini-timeline ribbon:** the entity's own life across time; clicking moves the
  global T and every fact on the page re-anchors ("Paris in 1420" vs "Paris today").
- **Fact panels (kind-specific):**
  - _Polity:_ government, leaders (timeline), capitals (timeline), territory
    evolution (small-multiple maps per era), population, currencies, flags, wars,
    treaties, admin divisions, largest cities.
  - _Place/City:_ founding, historical names, ownership chain (which polity, when),
    population curve, major events here, notable buildings, transport links, media.
  - _Person:_ life dates, roles/offices (timelines), affiliations, movements-map,
    works, relationships.
  - _Event/War/Treaty:_ when/where (map viz), participants, causes → consequences
    chains, order-of-battle where known, sources & historiography.
- **Connections:** knowledge-graph neighborhood ("related people, places, events,
  ideas"), each edge dated and typed.
- **Learn:** quiz-me-on-this button, add-to-study-set, mastery state if logged in.
- **Contribute:** "suggest an edit / add a fact / report an issue" — entry into the
  contribution flow (doc 08 §2) with the entity pre-selected.
- **Citations everywhere:** every fact carries its provenance popover (source,
  confidence, alternative interpretations).

## 4. Search

One omnisearch (web: ⌘K + header field; iOS: pull-down + tab): entities by any
historical name/spelling ("Constantinople" finds Istanbul, scoped to the right
eras), dates ("28 June 1914" jumps the timeline), natural-language questions
("who ruled France during the American Revolution?") answered via retrieval over
canonical assertions with linked, citable results — never a bare generated
paragraph. Results are time-aware: searching while T=1200 ranks era-relevant
results first, with a "in other eras" section.

## 5. Learning Surfaces

- **Quiz center:** by geography (countries, capitals, flags, rivers, mountains),
  by history (leaders, empires, events, timelines), by era/region, or "quiz me on
  what I'm looking at" (viewport+T aware).
- **Map-native question types:** click-the-country (at T!), drag-the-border-era,
  place-the-event-on-the-timeline, name-the-flag, order-the-events.
- **Review queue (SRS):** daily reviews, streaks, forecast. iOS: notifications,
  lock-screen widget, offline packs.
- **Challenges:** daily (same for everyone, shareable result), weekly deep-dives,
  custom study sets (creatable from any page/viewport, shareable to classes).
- **Progress:** mastery per region×era×topic (heat-grid), achievements, analytics.

## 6. Contribution Surfaces (public, Wikipedia-style — ADR-017)

- Every page and map feature: **Suggest an edit**. Guided, structured editors —
  "correct this date" (with HistoricalDate precision picker), "add an event",
  "add a source", "redraw this border segment" (web map editor with snapping and
  era context; iOS submits geometry _annotations_, full border drawing is web-only).
- Proposal composer always requires: the claim (structured), validity interval,
  sources, rationale. The AI gate's feedback renders inline (missing citation,
  conflict with existing assertion X — "did you mean to dispute it?").
- **My contributions** dashboard: statuses, reviewer comments, reputation tier,
  credit history. Revision history and diffs are public on every entity.

## 7. Web Client Specifics (reference client)

- React + Vite SPA; TanStack Router/Query; Zustand for the instrument state
  (T, viewport, layers, selection); MapLibre GL JS + deck.gl overlays.
- SSR layer for public entity pages (share/SEO) added per roadmap; the SPA and SSR
  share components and the GraphQL client.
- Design system: tokens (color/type/space/motion) + Radix primitives + Storybook;
  cartographic palette is part of the design system (layer hues, uncertainty
  textures, era-neutral basemap).
- Accessibility: WCAG 2.2 AA; full keyboard operation of map+timeline (arrow-key
  scrubbing, focusable features); reduced-motion honored (crossfades → cuts);
  screen-reader narration of snapshot ("In 1848 this region is part of Austria…").
- Admin/curation app is a separate route-space (`/admin`) sharing the design
  system; web-only forever by policy.

## 8. iOS Client Specifics

- Swift + SwiftUI; MapLibre Native; Apollo iOS with the same persisted queries;
  GRDB/SQLite offline store; background sync of SRS state and queued proposals.
- Interaction: bottom-anchored one-thumb timeline scrubber with haptic detents at
  data-resolution boundaries; long-press a feature for the context card; pinch on
  timeline to change temporal zoom.
- System integration: WidgetKit ("This day in history", daily challenge, review
  count), SRS notifications, Handoff/universal links to web URLs, ShareSheet
  (share a view = the same deep-link URL), Siri shortcut "show the world in 1200".
- Offline: study packs (region×era bundles: tiles + snapshot docs + quiz items)
  downloadable for planes and classrooms; contribution drafts queue offline.
- Parity policy: iOS tracks the web feature set with a documented parity matrix
  (roadmap gates); admin/curation and full border-editing excluded by design.

## 9. Performance & Quality Bars (both clients)

Initial interactive < 3s on median hardware; timeline scrub 60fps; tile-swap
< 100ms perceived; every interactive element reachable in ≤3 interactions from
the instrument; zero dead-end pages (every page links onward into the graph);
error states always render _something_ (cached snapshot, retry affordance) — the
map never goes blank.
