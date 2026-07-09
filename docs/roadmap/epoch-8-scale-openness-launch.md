# Epoch 8 — Scale, Openness & Launch (Phases 90–100)

**Theme:** make it fast everywhere, open to everyone, and launch — web publicly,
iOS 1.0 on the App Store, and a developer API. Exit state: Chronos is live, its
community is contributing, and roadmap v2 for the next decade exists.

---

### Phase 90 — Performance & scale hardening — `PLANNED`

**Objective.** Production-scale load: read replicas, cache-tier review (CDN/snapshot/tile hit rates), query-plan audit on largest tables, load tests to 10× projected launch traffic; production environment stood up via IaC.
**Requirements.** Replica routing for GraphQL reads; hot-path profiling and fixes; partitioning applied where measured (doc 03 §10); production infra (multi-AZ, WAF, rate limiting); capacity model documented.
**Acceptance.** All doc 05 §7 budgets green at 10× load; failover drill (replica promotion) passes; capacity model reviewed.
**DB.** Replicas, partitions as measured. **API.** Routing. **Frontend.** —
**Testing.** Load suites in CI (scaled) + scheduled full runs.
**Docs.** Capacity & scaling runbook.
**Depends on.** Epoch 7 complete. **Risks.** Unknown hot spots — profiling before optimizing.
**Estimate.** 2.5 weeks.

### Phase 91 — Internationalization — `PLANNED`

**Objective.** Localized UI (initial locales: EN + 2–3 by audience data) and multilingual knowledge surfaced (entity names already multilingual — display them; localized summaries via translation-into-review).
**Requirements.** UI i18n across web/iOS (message catalogs, RTL-readiness audit); locale-aware HistoricalDate formatting (spec extension, golden vectors per locale); name display policy per locale (endonym/exonym rules from doc 08 §1); translation workflow through curation (AI-drafted, human-reviewed per ADR-014).
**Acceptance.** Full product walkthrough in a second locale; date formatting vectors pass; naming policy honored in fixtures (Deutschland/Germany/Allemagne).
**DB.** Localized-content tables where needed. **API.** Locale parameters. **Frontend.** Both clients localized.
**Testing.** Pseudo-locale automation; per-locale golden vectors.
**Docs.** Localization guide.
**Depends on.** P90. **Risks.** Scope — UI+names first, full content translation is continuous work thereafter.
**Estimate.** 2.5 weeks.

### Phase 92 — Accessibility completion & audit — `PLANNED`

**Objective.** WCAG 2.2 AA across web; iOS accessibility audit (VoiceOver, Dynamic Type, contrast); the map/timeline non-visual experience finished (snapshot narration as the map's accessible equivalent — doc 06 §7).
**Requirements.** External audit engagement; remediation sprint; accessible-map narration ("In 1848 this region…") completed and user-tested with assistive-tech users; a11y regression suites locked in CI for both clients.
**Acceptance.** Audit report issues resolved or dispositioned; assistive-tech user test recorded; CI gates active.
**Docs.** Accessibility conformance statement (published).
**Depends on.** P90. **Risks.** Map a11y is genuinely hard — the narration path is the committed answer, budget accordingly.
**Estimate.** 2 weeks.

### Phase 93 — Narrative tours & story maps v1 — `PLANNED`

**Objective.** The `narrative` module shipped (doc 07 §6): curated tours (T+viewport+layers+entities+cited text per stop), tour player on web+iOS, authoring tool for editors; launch set of showcase tours.
**Requirements.** Tour model + player (scrub-along storytelling); authoring in admin (AI drafts into review per P87); 8–10 launch tours (e.g., Fall of Rome, Silk Road, 1848, Decolonization); tours quizzable (study-set integration).
**Acceptance.** Launch tours play beautifully on both clients (user-tested); authoring E2E works; tours citable like all content.
**DB.** `narrative.*`. **API.** Tour queries. **Frontend.** Player (web+iOS) + authoring (admin).
**Testing.** Player E2E; content review protocol.
**Docs.** Tour authoring guide.
**Depends on.** P87, P74. **Risks.** Content production time — start authoring early in the epoch, parallel to engineering.
**Estimate.** 2.5 weeks.

### Phase 94 — Educator features: classes & assignments — `PLANNED`

**Objective.** Classroom value (doc 00 audiences #2): educator accounts, classes, study-set/tour assignment, progress dashboards, misconception reports; privacy posture for minors reviewed.
**Requirements.** Class/roster model (privacy-first: minimal PII, admin consent flows per jurisdiction guidance); assignment flows over P70 sets + P93 tours; educator dashboards on P71 analytics; export for gradebooks (CSV first).
**Acceptance.** Pilot classroom (recruited) runs an assignment cycle end-to-end; privacy review signed off; dashboards useful per educator feedback.
**DB.** `learning.class*`. **API.** Educator mutations/queries. **Frontend.** Educator surfaces (web; iOS read-only progress).
**Testing.** E2E assignment cycle; privacy tests (data isolation).
**Docs.** Educator guide; minors-privacy policy.
**Depends on.** P70, P71, P93. **Risks.** Ed-privacy regulatory variance — conservative default posture.
**Estimate.** 2.5 weeks.

### Phase 95 — Public API v1 & developer portal — `PLANNED`

**Objective.** The research/developer promise (doc 05 §1): REST public API (entities, snapshots, timelines, search; OpenAPI-specified), API keys + quotas, docs portal with attribution/licensing terms per response.
**Requirements.** REST facade over the same read services; key management + quotas + abuse monitoring; OpenAPI + generated docs + quickstarts; data-license clarity in every payload (attribution stack, doc 04 §4); semver + deprecation policy published (doc 05 §5).
**Acceptance.** External tester builds a small app from docs alone; quotas enforce; license terms render in responses; contract tests pin v1.
**DB.** Key/quota tables. **API.** Public v1. **Frontend.** Developer portal.
**Testing.** Contract suite (permanent); abuse tests.
**Docs.** The portal is the doc.
**Depends on.** P90. **Risks.** Freezing contracts — v1 scope deliberately conservative.
**Estimate.** 2.5 weeks.

### Phase 96 — Exports, citations & research tools — `PLANNED`

**Objective.** Scholarly affordances: data exports (entity/region-period extracts in standard formats: GeoJSON, CSV, JSON-LD), citation generation (cite this page/claim/map-view, incl. revision-pinned permalinks via P81 as-of), embeds (interactive map-view embeds).
**Requirements.** Export builder (license-filtered: only redistributable data exports — registry-enforced); citation formats (Chicago/APA/BibTeX) incl. revision watermark; oEmbed/iframe embeds with attribution; rate/size governance.
**Acceptance.** Export a region-period extract legally clean per registry; citation of a claim resolves years later via revision permalink (tested against as-of); embed renders on external test page.
**DB.** Export bookkeeping. **API.** Export/citation endpoints. **Frontend.** Cite/export/embed UX.
**Testing.** License-filter tests (critical); permalink round-trips.
**Docs.** Researcher guide.
**Depends on.** P81, P95. **Risks.** License filtering correctness — registry-driven, tested, audited.
**Estimate.** 2 weeks.

### Phase 97 — Security audit, DR & migration rehearsal — `PLANNED`

**Objective.** Pre-launch hardening: external penetration test, dependency/secret audit, disaster-recovery drills (full restore, region loss tabletop), and a production-scale migration rehearsal (doc 03 §11 formalized).
**Requirements.** Pentest engagement + remediation; DR runbooks exercised (RTO/RPO targets set and met); expand→backfill→contract rehearsal on a production-scale copy; incident-response policy finalized (incl. wrongness-as-incident, doc 08 §7).
**Acceptance.** Pentest criticals/highs closed; restore drill within RTO; rehearsal documented; on-call rotation and escalation live.
**Docs.** Security posture summary (public-appropriate version); IR runbooks.
**Depends on.** P90. **Risks.** Findings volume — schedule remediation buffer.
**Estimate.** 2.5 weeks.

### Phase 98 — Web public launch — `PLANNED`

**Objective.** Open the doors: onboarding flows, marketing site, status page, support/feedback channels, launch-day operations; contribution opens per Epoch 7 beta learnings (tiered rollout).
**Requirements.** First-run experience (the "scrub 1815→1914" wow moment early); marketing site + press kit (honest claims — coverage map published); status page + support intake; launch runbook (traffic plans, rollback levers, comms); analytics goals defined.
**Acceptance.** Launch executed per runbook; week-one stability within SLOs; feedback triage operating; coverage honesty page live.
**Frontend.** Onboarding + marketing site.
**Depends on.** P90–P97. **Risks.** Traffic spikes — P90 headroom + CDN posture; contribution flood — tier gates ready.
**Estimate.** 2 weeks.

### Phase 99 — iOS 1.0 App Store launch — `PLANNED`

**Objective.** Ship iOS 1.0: App Store review readiness (guidelines, privacy nutrition labels, age rating), launch marketing assets, phased release, post-launch monitoring.
**Requirements.** App Store metadata/screenshots/preview video; privacy labels from telemetry audit; review-guideline pass (UGC rules: contribution surfaces need reporting/moderation visible — P86 satisfies); phased rollout config; crash/ANR monitoring SLOs.
**Acceptance.** App approved and released phased to 100%; crash-free ≥99.5%; App Store UGC compliance verified; parity matrix published in docs.
**Frontend (iOS).** Release polish.
**Depends on.** P77 beta learnings, P92, P98. **Risks.** Review surprises — UGC compliance pre-checked; buffer for resubmission.
**Estimate.** 2 weeks.

### Phase 100 — Post-launch review, sustainability & Roadmap v2 — `PLANNED`

**Objective.** Close the founding roadmap: full architecture audit against docs 00–08 (amend where reality diverged), launch retrospective, sustainability plan (funding/licensing decisions per ADR-013 revisit), community governance maturation plan, and **Roadmap v2** for the next horizon (Android, deeper regional HGIS programs, shared-boundary topology model, 3D/terrain-through-time, migration/economy layers, API federation, sandbox mode evaluation — the doc 02 deferred table becomes the seedbed).
**Requirements.** Retrospective with metrics vs doc 00 §9 success definitions; blueprint amendments merged; sustainability decision record; Roadmap v2 authored to the same standard as this one.
**Acceptance.** Blueprint and reality agree in writing; Roadmap v2 exists and is approved; every phase 1–99 carries a DONE stamp with dates and revision references; the changelog tells the whole story.
**Docs.** Everything — that is the phase.
**Depends on.** P1–P99. **Risks.** Declaring victory instead of auditing — the epoch-review discipline, one last time.
**Estimate.** 2 weeks.

---

**Epoch 8 total: ~25 weeks (≈6 months).**

---

## Grand total

100 phases · ~214 weeks of sequential work (≈4–4.5 years with a small core team,
before parallelization). The plan is deliberately honest about this: Chronos is a
decade-class project, and this roadmap is its first complete traversal — reviewed
and re-scoped at every epoch boundary, never silently.
