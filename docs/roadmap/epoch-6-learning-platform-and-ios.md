# Epoch 6 — Learning Platform & iOS (Phases 64–77)

**Theme:** Chronos becomes a place you *learn*, and it arrives on the iPhone.
Quiz engine, FSRS spaced repetition, challenges, mastery analytics on web — then
the native iOS app (ADR-016) through TestFlight beta. Exit state: the full
learning loop on web; iOS beta with instrument, pages, learning, offline packs.

---

### Phase 64 — Learning module foundation: the item model — `PLANNED`
**Objective.** Quiz item storage per doc 07 §2.1: templates+parameters, answers, distractor strategies, `derived_from` assertion links, media/map specs, difficulty fields; the assertion-change→item-flag consumer.
**Requirements.** `learning.item` (+bank/versioning); event-bus consumer flagging items when source assertions change/retire; item lifecycle (draft→review→active→retired) using curation review machinery for the public bank (doc 07 §2.2).
**Acceptance.** Fixture items link to assertions; editing a source assertion flags dependents (test); lifecycle transitions audited.
**DB.** `learning.*` foundation. **API.** Internal item services. **Frontend.** —
**Testing.** Flag-propagation integration tests.
**Docs.** Learning module charter.
**Depends on.** Epoch 5 complete (content breadth makes items worth building).
**Risks.** Item/assertion coupling design — this phase is schema-bedrock for learning; review accordingly.
**Future.** Everything in this epoch.
**Estimate.** 2 weeks.

### Phase 65 — Item generation v1: locate & identify families — `PLANNED`
**Objective.** Template engine generating map-native and identify items from canon: click-country-at-T, capital→polity, flag→polity (era-aware), river/mountain locate, leader identify.
**Requirements.** Template engine over canonical queries; distractor selection via relatedness (P44) with plausibility rules (neighbors/era-mates, never anachronisms unless intended); difficulty priors from importance+distractor distance; generation runs as reviewable batches into the bank.
**Acceptance.** ≥5k reviewed active items across ≥6 templates covering modern + statehood-era content; anachronism checks pass (no 1850 quiz asking about Germany's flag *as a country* pre-1871 — fixture-tested).
**DB.** Generation bookkeeping. **API.** — **Frontend.** —
**Testing.** Template unit tests + anachronism fixtures; sampled human review protocol.
**Docs.** Template authoring guide.
**Depends on.** P64. **Risks.** Subtle temporal validity in items — the anachronism suite is permanent.
**Future.** Temporal/relational families P68-adjacent; AI phrasing variants P87.
**Estimate.** 2.5 weeks.

### Phase 66 — Quiz player (web) with map-native types — `PLANNED`
**Objective.** The quiz-taking experience: session player, map-click answers (at T!), timeline-placement answers, multiple choice, ordering; immediate feedback with "learn why" links into pages.
**Requirements.** Player components (map-question harness reusing the instrument in question mode); answer recording API; feedback with citation links; accessibility for all question types (keyboard map answering — doc 06 §7 discipline).
**Acceptance.** Full session across all v1 types works on web incl. keyboard-only; attempts recorded; "quiz me on what I'm looking at" (viewport+T scoped) works.
**DB.** `learning.attempt`. **API.** Session/answer mutations. **Frontend.** Quiz player.
**Testing.** E2E sessions; a11y audit per type.
**Docs.** Player architecture.
**Depends on.** P65. **Risks.** Map-question interaction quality — user-test loop scheduled.
**Future.** iOS player P75.
**Estimate.** 2.5 weeks.

### Phase 67 — FSRS scheduler & review queue — `PLANNED`
**Objective.** Spaced repetition per doc 07 §3: FSRS memory states, due scheduling, the unified review queue, anti-burnout controls.
**Requirements.** FSRS implementation (worker-scheduled); per-learner parameter fitting job; review queue API + UI (due counts, forecast); caps/smoothing/vacation; personal-data isolation verified (doc 03 §9).
**Acceptance.** Retention simulation on synthetic history matches FSRS reference; queue UX complete; GDPR export includes SRS state.
**DB.** `learning.memory_state`, partitioned attempts. **API.** Review queue queries/mutations. **Frontend.** Review UI + forecast.
**Testing.** Scheduler property tests vs reference implementation; load tests.
**Docs.** SRS design + parameters methodology.
**Depends on.** P66. **Risks.** Scheduler correctness — reference-vector testing.
**Future.** iOS notifications/widgets (P75) drive from due states.
**Estimate.** 2 weeks.

### Phase 68 — Adaptive difficulty & session composer — `PLANNED`
**Objective.** Elo-style item/learner ratings from attempt data; adaptive session composition (due reviews + weak areas + novelty at ~70–80% target success); temporal/relational item families added.
**Requirements.** Rating update pipeline; composer with scope filters (region/era/topic); order-events and which-came-first templates; difficulty telemetry dashboards.
**Acceptance.** Simulated learners converge to target success band; new families reviewed into bank; composer respects scope + due-first rules.
**DB.** Ratings tables. **API.** Composer parameters. **Frontend.** Session setup UX.
**Testing.** Simulation tests; composer unit tests.
**Docs.** Adaptivity methodology (versioned — efficacy claims depend on it).
**Depends on.** P67. **Risks.** Cold-start — importance-based priors documented.
**Future.** IRT upgrade path noted (doc 07 §2.3).
**Estimate.** 2 weeks.

### Phase 69 — Daily & weekly challenges, streaks — `PLANNED`
**Objective.** The daily challenge (global 10 items, shareable result grid), weekly deep-dive (region×era), streaks — motivation without dark patterns (doc 07 §4).
**Requirements.** Deterministic seeded daily generation (importance+variety constraints); share-card renderer (P50 machinery); streak accounting with generous repair policy (anti-loss-aversion stance documented); weekly deep-dive composition mixing exploration prompts + items.
**Acceptance.** Same daily worldwide; result grid shareable; streaks survive DST/timezones (property-tested); weekly renders a coherent themed set.
**DB.** Challenge tables. **API.** Challenge queries/mutations. **Frontend.** Challenge surfaces + share cards.
**Testing.** Determinism + timezone property tests.
**Docs.** Challenge design doc.
**Depends on.** P68. **Risks.** Low.
**Future.** iOS widget (P75) surfaces the daily.
**Estimate.** 1.5 weeks.

### Phase 70 — Custom study sets & sharing — `PLANNED`
**Objective.** Any page/viewport/search/tour → a study set; sets subscribe to canon (auto-update with change notices); shareable links; educator-friendly (classes arrive P94).
**Requirements.** Set model (scope definition, item selection strategy, canon subscription); set player integration with SRS (opt-in add-to-reviews); share/permalink; set update notices when underlying facts changed.
**Acceptance.** Build "Napoleonic Europe" set from a viewport+era in <1 min; a canonical correction updates the set with a visible notice; shared set opens for another account.
**DB.** Set tables. **API.** Set CRUD (user-owned content — not curation path). **Frontend.** Set builder + player.
**Testing.** Subscription-update integration tests.
**Docs.** Sets design.
**Depends on.** P68. **Risks.** Low.
**Future.** Classroom assignment P94.
**Estimate.** 1.5 weeks.

### Phase 71 — Mastery model, analytics & achievements — `PLANNED`
**Objective.** Region×era×topic mastery cells (coverage × retention × recency), the heat-grid UI, learner analytics (trends, forecasts), achievements per doc 07 §4.
**Requirements.** Mastery computation worker; heat-grid (doc 06 §5) with drill-in; achievement engine (exploration/mastery/contribution categories, no engagement-bait per policy); telemetry events finalized (privacy-scoped, doc 08 §5).
**Acceptance.** Mastery reflects simulated learning histories sensibly; heat-grid navigates to weak-area sessions; achievements fire correctly; analytics dashboards live.
**DB.** Mastery/achievement tables. **API.** Analytics queries. **Frontend.** Progress surfaces.
**Testing.** Computation tests on synthetic histories.
**Docs.** Mastery formula (versioned); efficacy metrics methodology (doc 00 §9 commitment).
**Depends on.** P67, P68. **Risks.** Vanity metrics temptation — methodology doc is the check.
**Future.** Educator dashboards P94.
**Estimate.** 2 weeks.

### Phase 72 — iOS foundation — `PLANNED`
**Objective.** The `/ios` app skeleton per ADR-016: Swift/SwiftUI project, CI (build+test+TestFlight lanes), OIDC auth, Apollo codegen from persisted queries, design tokens ported, Swift `historical-date` implementation against golden vectors, universal links.
**Requirements.** Xcode project + SPM structure; fastlane or Xcode Cloud CI; token pipeline (design tokens → Swift constants); GRDB store scaffolding; universal links to P50 URLs; crash/analytics telemetry (privacy-aligned).
**Acceptance.** Sign in, resolve an entity via GraphQL, render a basic page natively; Swift historical-date passes all golden vectors; CI ships a TestFlight build.
**DB.** — **API.** — (consumes existing) **Frontend (iOS).** Skeleton app.
**Testing.** Golden-vector suite in Swift; snapshot tests bootstrapped.
**Docs.** iOS architecture README; parity matrix started (doc 06 §8).
**Depends on.** P50; learning APIs stable (P64–71 shapes final).
**Risks.** Third golden-vector implementation drift — shared vectors are the contract.
**Future.** Everything iOS.
**Estimate.** 2.5 weeks.

### Phase 73 — iOS map instrument — `PLANNED`
**Objective.** The instrument, natively: MapLibre Native with the shared style, bottom one-thumb timeline scrubber with haptic resolution detents, layer tray, selection cards, deep-link state (doc 06 §8).
**Requirements.** Style/manifest parity with web (same tiles, same buckets); scrubber gesture design (pinch temporal zoom, detents at data resolution); 60fps scrub on target devices (iPhone 12+); reduced-motion + VoiceOver paths for map/timeline.
**Acceptance.** Scrub 1815→today natively at 60fps; feature tap → context card → page; open a shared web URL → identical view in-app.
**Testing.** Performance instrumentation tests; UI tests for scrub/select; accessibility audit.
**Docs.** Parity matrix updates.
**Depends on.** P72. **Risks.** The signature interaction on touch — design iterations budgeted; MapLibre Native gaps may need upstream contributions (time-boxed, tracked).
**Estimate.** 3 weeks.

### Phase 74 — iOS pages & search — `PLANNED`
**Objective.** Native dossier rendering (polity/place/city/person/event), omnisearch with the same time-aware behaviors, provenance popovers, connections rail.
**Requirements.** SwiftUI dossier components mirroring the page architecture (not pixel-cloning web — native idiom, same information architecture); search UX (pull-down + tab); citation surfaces complete (trust parity is non-negotiable).
**Acceptance.** Showcase entities render fully cited native pages; search relevance parity (same suite as P48 through the same API); navigation graph has no dead ends.
**Testing.** Snapshot tests per dossier kind; E2E UI tests.
**Docs.** Parity matrix.
**Depends on.** P73. **Risks.** Scope — pages are many; the dossier component system contains it.
**Estimate.** 2.5 weeks.

### Phase 75 — iOS learning: reviews, notifications & widgets — `PLANNED`
**Objective.** The learning loop natively: quiz player (touch-first map answers), review queue, SRS notifications, WidgetKit ("This day in history", daily challenge, due count), streaks.
**Requirements.** Native player for all item families; local notification scheduling from due forecasts (server-synced); three widgets; challenge share sheets; App Store-safe engagement posture (no dark patterns — policy applies).
**Acceptance.** Full learning loop on device incl. notification→review flow; widgets update correctly; challenge shareable.
**Testing.** UI tests; notification scheduling tests; widget snapshot tests.
**Docs.** Parity matrix; notification policy.
**Depends on.** P67–P69, P74. **Risks.** Notification tuning — conservative defaults, user control.
**Estimate.** 2.5 weeks.

### Phase 76 — iOS offline: study packs & sync — `PLANNED`
**Objective.** Region×era study packs (tiles + snapshot docs + items) downloadable; offline reviews and reading; robust sync (attempts queue, SRS merge per doc 07 §3).
**Requirements.** Pack builder service (server-side bundling); GRDB offline stores; sync protocol (idempotent attempt upload, server re-schedule, conflict policy documented); storage management UX.
**Acceptance.** Airplane-mode: complete reviews + browse packed region/era; reconnect merges cleanly (chaos-tested); pack sizes reasonable (<300MB showcase pack).
**DB.** Pack manifest tables. **API.** Pack endpoints. **Frontend (iOS).** Pack management + offline modes.
**Testing.** Sync chaos tests; offline E2E.
**Docs.** Offline architecture + sync protocol spec.
**Depends on.** P75. **Risks.** Sync edge cases — conservative protocol, server authority.
**Estimate.** 2.5 weeks.

### Phase 77 — Epoch 6 review & TestFlight beta — `PLANNED`
**Objective.** Audit; iOS TestFlight beta to an invited cohort; learning-efficacy baseline metrics collection begins; parity matrix published.
**Requirements.** Beta program (feedback intake routed to issues); efficacy dashboards live (doc 07 §5); review standard template; Epoch 7 re-scope.
**Acceptance.** Beta shipped and iterated once on feedback; efficacy baseline recorded; report merged; phases DONE-stamped.
**Depends on.** P64–P76. **Estimate.** 2 weeks.

---

**Epoch 6 total: ~31 weeks (≈7 months).**
