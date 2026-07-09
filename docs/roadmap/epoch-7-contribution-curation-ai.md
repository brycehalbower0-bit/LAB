# Epoch 7 — Contribution, Curation & AI (Phases 78–89)

**Theme:** open the gates safely. World-class curation tooling for staff, the AI
validation gate, then **public Wikipedia-style contribution** (ADR-017, doc 08 §2)
with reputation, protection, and moderation. Exit state: invited-community
contribution beta running through propose → AI gate → human review → canon.

---

### Phase 78 — Admin review workbench — `PLANNED`
**Objective.** The reviewer's home (doc 08 §4): queues, structured diff viewer, approve/request-changes/reject flows, batch review for imports — replacing the internal CLI-era workflow.
**Requirements.** `/admin` route-space (web-only, role-gated); queue views with filtering/routing metadata; structured assertion diffs (before/after with HistoricalDate-aware rendering); reviewer comment threads; batch operations for bulk-import revisions; full audit surfacing.
**Acceptance.** A staff reviewer processes a mixed queue (single edits + an import batch) entirely in UI; every action lands in audit log; review latency instrumented.
**DB.** Queue routing metadata. **API.** Curation queries/mutations completed for UI use. **Frontend.** Admin shell + workbench.
**Testing.** E2E review journeys; permission-matrix tests.
**Docs.** Reviewer handbook v1.
**Depends on.** Epoch 6 complete (but logically only on P7-era kernel — sequenced here to build tooling against mature content).
**Risks.** Tool ergonomics decide review throughput — user-test with actual reviewers.
**Estimate.** 2.5 weeks.

### Phase 79 — Map & border editor (admin) — `PLANNED`
**Objective.** Geometry editing for curators: draw/adjust border segments with era context, snapping to existing geometry versions, certainty assignment, cross-time preview (doc 08 §4).
**Requirements.** Web map editor (draw/edit tooling over MapLibre); snapping + topology warnings (sliver detection live); era context layers (neighboring claims at T); output = geometry version + border-claim proposal through the standard pipeline; affected-bucket preview ("this edit changes tiles for 1878–1885").
**Acceptance.** A curator corrects a fixture border, previews affected years, submits; approval rebuilds exactly the previewed buckets; topology warnings fire on seeded errors.
**DB.** — **API.** Editor support queries. **Frontend.** Border editor.
**Testing.** Editor E2E; geometry-output validation tests.
**Docs.** Border editing guide (extends P30 methodology).
**Depends on.** P78, P31. **Risks.** Hardest UI in the admin suite — scope to segment-level correction first, full redraw flows later.
**Estimate.** 3 weeks.

### Phase 80 — Timeline editor, source manager & citation tooling — `PLANNED`
**Objective.** Curator tools for time and provenance: validity-interval editing with conflict visualization, source registry management, citation reuse search (doc 08 §4).
**Requirements.** Timeline editor (drag interval bounds with precision picker; overlapping-primacy conflicts highlighted live); source registry CRUD with reliability class + license gates; citation search ("cite this source again"); locator helpers.
**Acceptance.** Curator fixes a wrong reign interval seeing conflicts resolve live; adds a new source with license record; reuses it across assertions.
**DB.** — **API.** Source/citation mutations. **Frontend.** Editors.
**Testing.** E2E; conflict-visualization component tests.
**Docs.** Source management runbook.
**Depends on.** P78. **Risks.** Low.
**Future.** Public contributors get simplified versions of these editors (P84).
**Estimate.** 2 weeks.

### Phase 81 — Version history UX, diff & rollback — `PLANNED`
**Objective.** Public-facing history: every entity's revision history tab, human-readable diffs between any two revisions, admin rollback flows (single revision, contributor set), record-time browsing ("Chronos as of last March").
**Requirements.** History UI on all dossiers (public read); diff rendering incl. map-visual diffs for geometry; rollback with mandatory reason through curation path; as-of-revision read mode (bitemporal query surface, doc 03 §8).
**Acceptance.** Any entity's history browsable publicly with attributions; geometry diff renders side-by-side maps; rollback restores exactly (existing P7 tests extended to UI); as-of mode renders a past state with a banner.
**DB.** — **API.** History/as-of queries. **Frontend.** History surfaces.
**Testing.** E2E history journeys; as-of correctness fixtures.
**Docs.** Updates.
**Depends on.** P78. **Risks.** As-of query perf — bounded/watermarked implementation, budgets apply.
**Future.** Research citations of Chronos-at-revision (P96 permalinks).
**Estimate.** 2 weeks.

### Phase 82 — AI-assist foundation — `PLANNED`
**Objective.** The `ai-assist` module proper (ADR-014): provider abstraction (Anthropic first), prompt/config versioning, full audit logging (prompt, model, retrieved context, output hash), evaluation harness, cost/rate governance; absorb the P49 retrieval harness.
**Requirements.** Provider client abstraction; task registry (each AI task = versioned config + eval set + rollout gate); retrieval-grounding utilities over canon; generation labeling plumbing (`generated — pending review` metadata end-to-end); eval harness in CI for pinned configs.
**Acceptance.** P49 NL answering runs through the new foundation with identical eval results; a config change requires passing its eval gate; audit queries reconstruct any AI interaction.
**DB.** `ai_assist` audit/config tables. **API.** Internal task APIs. **Frontend.** —
**Testing.** Harness meta-tests; audit completeness tests.
**Docs.** AI-assist architecture + task authoring guide.
**Depends on.** P49. **Risks.** Provider churn — abstraction + evals make swaps safe.
**Future.** Gate (P83), drafting (P87), gap detection (P88).
**Estimate.** 2 weeks.

### Phase 83 — AI validation gate v1 — `PLANNED`
**Objective.** The automatic pre-review analysis of every proposal (doc 08 §2): mechanical+temporal+geometric consistency vs canon (reusing P37 integrity checks), citation/source verification, duplicate/conflict detection, spam/vandalism scoring, structured review briefs; bounce-with-reasons path.
**Requirements.** Gate pipeline on proposal submission (async, SLA'd); brief schema (findings, conflicts with existing assertions, suggested duplicates, risk score, checklist for reviewer); bounce rules (mechanical failures only — judgment calls always go to humans); precision/recall measurement against reviewer outcomes from day one; appeal path.
**Acceptance.** Seeded proposal suite (good, uncited, conflicting, duplicate, vandalistic) routes correctly; briefs render in workbench; gate metrics dashboard live; humans can override every gate outcome.
**DB.** Gate results storage. **API.** Gate status on proposals. **Frontend.** Brief rendering in workbench.
**Testing.** The seeded suite is a permanent eval set; adversarial cases included.
**Docs.** Gate policy + metrics methodology (doc 08 §5 commitments).
**Depends on.** P37, P78, P82. **Risks.** Over-blocking (contributor alienation) vs under-blocking (reviewer overload) — bounce-minimal defaults, measured tuning.
**Estimate.** 2.5 weeks.

### Phase 84 — Public contribution v1: facts, dates, events & sources — `PLANNED`
**Objective.** Open structured contribution to registered users (contributor role): guided proposal composers — correct-a-date (precision picker), add-an-event, add-a-source/citation, fix-a-name, flag-a-claim (doc 06 §6) — through gate and review.
**Requirements.** Composer UX with inline gate feedback (missing citation, conflict prompts "dispute instead?"); My Contributions dashboard (statuses, reviewer comments, credit); review routing by topic/tier; review-latency SLO instrumented (roadmap standing risk 4); contributor onboarding content.
**Acceptance.** An external tester submits a real correction end-to-end to canon with credit visible in history; bounce and request-changes loops work; SLO dashboard live.
**DB.** — **API.** Public proposal mutations (rate-limited by tier). **Frontend.** Composers + dashboard (web; iOS submits simple fact proposals via same API).
**Testing.** E2E contribution journeys incl. rejection/appeal; abuse-path tests (rate limits, spam).
**Docs.** Public contributor guide; editorial policy published.
**Depends on.** P80, P81, P83. **Risks.** The social contract moment — invited cohort first (beta gate at P89), staff review capacity planned.
**Estimate.** 2.5 weeks.

### Phase 85 — Public contribution v2: geometry & map edits — `PLANNED`
**Objective.** Community border/geometry proposals: simplified web border-suggestion editor (segment corrections with era context), place-location fixes, front-line/route suggestions; iOS geometry *annotations* (flag + describe, doc 06 §6).
**Requirements.** Contributor-grade editor (P79 machinery, guarded scope); geometry proposals get map-visual diffs in review automatically; certainty-class suggestions validated by gate geometry checks.
**Acceptance.** A community tester proposes a border segment correction with sources; reviewer sees visual diff + gate brief; approval rebuilds correct buckets.
**DB.** — **API.** Geometry proposal support. **Frontend.** Contributor editor; iOS annotation flow.
**Testing.** E2E; geometry-validation adversarial tests.
**Docs.** Map contribution guide.
**Depends on.** P79, P84. **Risks.** Geometry review burden — segment-scoped proposals + visual diffs keep it tractable.
**Estimate.** 2 weeks.

### Phase 86 — Reputation, protection & moderation — `PLANNED`
**Objective.** The trust system (doc 08 §2): reputation tiers (new→established→trusted→reviewer) earned per topic area; protection levels (open/elevated/protected); moderation tooling (flags queue, reports, tier management, contributor-set rollback).
**Requirements.** Tier computation from review outcomes (transparent rules, logged transitions); protection settings per entity/region-period enforced in routing; community-reviewer promotion flow (staff-approved); anti-abuse: rate limits by tier, sockpuppet signals, mass-rollback tooling.
**Acceptance.** Simulated contributor history earns/loses tiers per rules; protected fixture topics route to senior editors only; moderation E2E (flag→triage→action→audit) works; mass rollback of a bad actor's set verified.
**DB.** Reputation/protection/moderation tables. **API.** Moderation mutations. **Frontend.** Admin moderation console; public tier display.
**Testing.** Rule simulations; abuse-scenario tests.
**Docs.** Trust & safety policy (public); moderation handbook.
**Depends on.** P84. **Risks.** Community fairness perception — transparent rules + appeal paths.
**Estimate.** 2.5 weeks.

### Phase 87 — AI drafting & quiz phrasing (into review) — `PLANNED`
**Objective.** AI as drafter (ADR-014 scope): educational summaries for entity pages, tour narration drafts, quiz phrasing variants and distractor suggestions — all grounded in canon, all into review queues, all labeled.
**Requirements.** Drafting tasks in the P82 registry (grounding: the entity's assertions + citations only; hard schema: every claim in a draft must map to an assertion ID or be flagged decorative); reviewer diff-against-sources UI; item-phrasing pipeline into P64 lifecycle; generation-label rendering wherever drafts appear pre-approval.
**Acceptance.** Draft summaries for 50 fixture entities reviewed: zero unmapped factual claims slip the schema check (automated) ; approved summaries render without generation label, rejected ones never surface; quiz phrasing variants measurably pass review at ≥70% (tuning target).
**DB.** — **API.** Draft task triggers (admin). **Frontend.** Draft review surfaces.
**Testing.** Claim-mapping schema tests (the anti-hallucination gate); eval sets per task.
**Docs.** Drafting task specs + editorial guidance.
**Depends on.** P82, P64. **Risks.** Subtle ungrounded claims — the assertion-mapping schema is the structural control, sampled human audit the backstop.
**Estimate.** 2 weeks.

### Phase 88 — Inconsistency detection, gap analysis & prioritization queue — `PLANNED`
**Objective.** AI + heuristics hunting canon problems: contradiction candidates (dates, overlaps, orphaned references), coverage gaps vs the region-period model, source-weakness reports; the living prioritization queue (doc 04 §5) as an admin artifact.
**Requirements.** Detection tasks (integrity-suite escalations + LLM-assisted candidate finding over assertion clusters) filing curation *issues* (never edits); coverage dashboards finalized (doc 04 §7); prioritization queue UI with scoring inputs editable by editors.
**Acceptance.** Seeded contradictions surface as issues with useful context; coverage dashboard matches sampled manual audit; the queue drives the next curation sprint's plan (process documented).
**DB.** Issue/queue tables. **API.** Issue queries. **Frontend.** Dashboards + queue console.
**Testing.** Detection precision measured on seeded suite.
**Docs.** Curation operations playbook.
**Depends on.** P82, P37. **Risks.** Noise — precision thresholds before enabling each detector.
**Estimate.** 2 weeks.

### Phase 89 — Epoch 7 review & contribution beta — `PLANNED`
**Objective.** Audit; open the invited contribution beta (community cohort, e.g., history-education and OpenHistoricalMap communities); measure the funnel (proposal→gate→review→canon rates, latency SLOs); tune; publish the trust & safety and editorial policies.
**Acceptance.** ≥4 weeks of beta data; SLOs met or re-planned; gate precision/recall reported; policies published; report merged; Epoch 8 re-scoped; phases DONE-stamped.
**Depends on.** P78–P88. **Estimate.** 2 weeks (plus concurrent beta runtime).

---

**Epoch 7 total: ~28 weeks (≈6.5 months).**
