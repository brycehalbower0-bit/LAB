# 00 — Vision & Principles

**Status:** Normative · **Owner:** Chief Architect · **Last updated:** 2026-07-09

---

## 1. The One-Sentence Vision

A user chooses any point in time and explores Earth exactly as it existed then —
politically, physically, culturally, and intellectually — with every fact sourced,
every entity connected, and every screen an opportunity to learn.

## 2. What Chronos Is

Chronos is simultaneously:

- **An interactive temporal GIS** — the map is the centerpiece; the timeline is the
  primary control. Scrubbing time changes borders, cities, routes, layers.
- **A historical atlas** — authoritative, cited, uncertainty-aware political and
  thematic maps for every supported period.
- **An encyclopedia** — every place, polity, person, event, and concept has a page,
  and every page is a timeline.
- **A knowledge graph** — typed, dated, sourced relationships connect everything.
- **A learning platform** — quizzes, spaced repetition, challenges, mastery tracking,
  built directly on the same canonical data users explore.
- **A research surface** — provenance, conflicting interpretations, and confidence
  are first-class, so scholars can trust and interrogate what they see.
- **A living commons** — like Wikipedia, but for the map of history: anyone can
  propose additions and corrections (borders, events, places, facts, sources).
  Every claim passes an AI validation gate and human editorial review before it
  becomes canon — open contribution, guarded truth.

## 3. What Chronos Is Not (Non-Goals)

Explicit non-goals prevent decade-scale drift:

- **Not a simulation or game.** We render what happened (with uncertainty), we never
  simulate counterfactuals as if they were history. (A clearly-labeled sandbox mode
  may exist someday; it will never share the canonical data path.)
- **Not a social network.** Community features serve curation and learning, not
  engagement metrics.
- **Not a real-time news product.** Recent history is supported at month/day
  granularity, but Chronos is not a breaking-news map.
- **Not an AI content farm.** AI drafts and suggests; humans and sources decide.
  Unreviewed generated text is never presented as fact.
- **Not precision theater.** Where history cannot support a sharp border or an exact
  date, we do not draw one. Fuzziness is rendered as fuzziness.

## 4. Core Philosophy: Everything Is Connected, Everything Is Temporal

Two axioms generate almost every architectural decision in this project:

**Axiom 1 — Temporality.** Every statement about the world is true _for an interval
of time_, known _with some precision_, asserted _by some source_, _with some
confidence_. Therefore the fundamental unit of knowledge is not "fact" but
**assertion(subject, claim, valid-time, precision, source, confidence)**.

**Axiom 2 — Connectedness.** No entity is an island. A battle links to a war, a war
to polities and treaties and people, people to places and ideas. Therefore entities
and typed relationships (both temporal) form one graph, and every page is a view
over that graph — never a hand-maintained silo.

Corollaries:

- A "country page" is a query, not a document.
- A "world snapshot at time T" is a query, not a pre-drawn map (though it may be
  materialized/cached).
- Quizzes are generated from the graph, so learning content can never diverge from
  encyclopedic content.
- Fixing a fact in one place fixes it everywhere it appears.

## 5. The Experience Pillars

### 5.1 The Map

The map is Earth through time. Timeline scrubbing changes: political borders,
polity existence, capitals, city presence/size, routes, war frontiers, thematic
layers (religion, language, population, climate, trade…). Target feel: smooth,
alive, cinematic — but every rendered feature is backed by a dated, sourced record.

### 5.2 The Timeline

Multi-resolution, honest about precision:

| Period                                | Default resolution              |
| ------------------------------------- | ------------------------------- |
| Deep prehistory → ~3000 BCE           | Era / millennium                |
| Ancient (~3000 BCE – 500 CE)          | Century, decade where supported |
| Post-classical (500–1500)             | Decade / year where supported   |
| Early modern & industrial (1500–1900) | Year                            |
| 20th century                          | Year → month                    |
| Recent decades                        | Month; day where events warrant |

Resolution is a property of the _data_, not the UI: the UI offers only the precision
the underlying assertions can support for that region/period.

### 5.3 The Snapshot

Selecting any date yields a **World Snapshot**: polities and borders, governments
and leaders, capitals, population estimates, major cities, languages, religions,
currencies, active wars and treaties, recent discoveries and cultural events,
births/deaths, exploration and trade activity — each item sourced and
confidence-scored. The snapshot is the app's central read model (see doc 03 §7).

### 5.4 The Pages

Location pages, country/polity pages, city pages, person pages, event pages — all
generated from the graph, all internally timelines, all cross-linked, all citable.

### 5.5 The Learning Loop

Explore → be quizzed on what you explored → spaced repetition schedules reviews →
mastery analytics guide what to explore next. Daily/weekly challenges and custom
study sets ride on the same engine.

### 5.6 The Contribution Loop

See something missing or wrong → propose an edit (a dated, sourced claim — possibly
a redrawn border) → **AI validation** checks sources, temporal and geometric
consistency, duplicates, and license compliance, and attaches a review brief →
**staff/editor review** approves, requests changes, or rejects with reasons →
approved claims enter canon with the contributor credited in the revision history.
Trusted contributors earn lighter-touch review; contested topics get stricter
protection. The full workflow is specified in doc 08.

## 6. Honest Uncertainty (Design Commitment)

- Dates carry **precision** (day/month/year/decade/century/era) and optional
  earliest/latest bounds.
- Borders carry **certainty classes** (surveyed, treaty-defined, approximate,
  frontier zone, disputed, conjectural) and are rendered differently for each.
- Population and economic figures are **estimates with ranges** and named sources.
- Conflicting interpretations coexist: the system stores competing assertions and
  the editorial layer selects a _primary_ view without deleting alternatives.
- The UI never fabricates crispness. A conjectural border is visibly conjectural.

## 7. Platforms

Chronos is delivered on two first-class platforms with feature parity as the goal
and honest sequencing as the method:

- **Web** — the reference client and the first to receive every capability. Full
  map/timeline instrument, encyclopedia pages (server-rendered for sharing/SEO),
  learning platform, and the admin/curation tooling (web-only).
- **iOS (native)** — Swift/SwiftUI with native MapLibre rendering. Same API, same
  knowledge, tuned for touch: one-thumb timeline scrubbing, gesture-driven map,
  offline study packs, widgets ("This day in history", daily challenge),
  notifications for spaced-repetition reviews. iOS is where the _learning loop_
  shines; curation/admin remains web-only.

Platform rules: no client owns data or logic that belongs in the platform API;
any feature shipped to one client must have an API contract that already serves
the other; Android follows post-launch via the same contract discipline (see
ADR-010/ADR-016 and the deferred-decisions table).

## 8. Audiences (in priority order)

1. **Curious learners** — students, autodidacts, trivia lovers, map nerds.
2. **Educators** — need reliable, citable, classroom-usable material and study sets.
3. **Researchers & writers** — need provenance, export, and API access.
4. **Contributors/curators** — need world-class editorial tooling (our admin system).

## 9. Definitions of Success (decade horizon)

- **Coverage:** every modern country and major historical polity; the majority of
  recorded human history reachable through the timeline.
- **Trust:** every rendered claim traceable to a source in ≤2 interactions.
- **Learning efficacy:** measurable retention gains via SRS analytics.
- **Longevity:** the data model survives feature generations; migrations, not rewrites.
- **Community:** a functioning editorial pipeline where curated contributions
  outpace core-team authoring.

## 10. Product Principles (tie-breakers for future arguments)

1. When correctness and beauty conflict, correctness wins — then we make
   correctness beautiful.
2. When a feature would require inventing data, the feature waits for data.
3. Depth for a few regions beats shallowness everywhere — but the _schema_ is
   global from day one.
4. Every new entity type must define its temporal semantics before it ships.
5. The reader's time is sacred: fast loads, obvious navigation, no dead ends —
   every page links onward into the graph.
6. If a curator can't fix it in the admin UI, it isn't done.
7. Ambiguity in requirements → write the question down in the decision log and ask;
   never guess silently.
