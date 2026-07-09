# 08 — Governance, Quality & AI Policy

**Status:** Normative · **Owner:** Product / Editorial Lead · **Last updated:** 2026-07-09

How truth is maintained: the editorial model, the public contribution workflow
("Wikipedia of the map", ADR-017), the admin system, the AI rules (ADR-014), and
the engineering quality doctrine.

---

## 1. Editorial Model

- **Canon** = the set of live, primary assertions (doc 03). Everything rendered as
  fact comes from canon; everything in canon has citations and a revision trail.
- **Editorial hierarchy:** contributors propose; reviewers verify; editors own
  topic areas and resolve disputes; an editorial board owns policy (style guide,
  naming policy, contested-topic policy, vocabulary changes).
- **Neutrality & naming policy:** contested names/borders follow a written policy
  (display endonym+exonym, present competing claims as parallel assertions,
  never adjudicate live geopolitical disputes — render them *as disputes*).
  The policy document is versioned in-repo and enforced in review.
- **Every claim challengeable:** any user can flag an assertion; flags open
  curation issues; resolution is recorded and visible in the entity's history.

## 2. The Public Contribution Workflow (ADR-017)

```
 contributor                AI VALIDATION GATE                human review
 ┌──────────┐   submit   ┌──────────────────────┐   brief   ┌────────────┐  approve  ┌───────┐
 │ guided   │ ─────────► │ • schema/mechanical  │ ────────► │ routed     │ ────────► │ CANON │
 │ proposal │            │ • citation & source  │           │ queue by   │           └───┬───┘
 │ composer │ ◄───────── │   verification       │           │ topic/tier/│  request      │
 └──────────┘  bounce    │ • temporal/geometric │           │ protection │  changes      │ credit +
      ▲        with      │   consistency vs canon│          │ (staff or  │ ◄──────►      │ revision
      │        reasons   │ • duplicate/conflict │           │ community  │  reject       │ history
      │                  │ • vandalism/spam     │           │ reviewers) │  with reasons │
      │                  │ • license compliance │           └────────────┘               ▼
      └──────────────────│ → structured review  │                              serving plane
                         │   brief for humans   │                              rebuilds
                         └──────────────────────┘
```

Rules:

1. **One pipeline.** Staff, community, pipelines, and AI drafts all flow through
   propose → gate → review → canon. No exceptions, enforced at the DB role level.
2. **The AI gate triages, humans decide.** The gate can *bounce* (mechanical
   failures, missing citations, spam) and *annotate*; it can never approve into
   canon. Gate verdicts are logged and auditable; false-bounce appeals go to humans.
3. **Reputation tiers** (`new → established → trusted → reviewer`): earned by
   approved-edit track record per topic area; grants expedited queues, larger
   batch sizes, and eventually review rights on unprotected topics. Tier changes
   are logged; abuse collapses tiers.
4. **Protection levels** per entity/region-period: `open` (default) →
   `elevated` (extra reviewer) → `protected` (senior editors only; e.g., live
   geopolitical disputes, high-vandalism targets).
5. **Attribution forever:** approved revisions credit their contributor in the
   permanent public history; rejected proposals keep reviewer reasoning for the
   contributor.
6. **Anti-abuse:** rate limits by tier, sockpuppet detection signals, mandatory
   sources (no "trust me"), and full reversibility (rollback of any revision or
   contributor's revision set via inverse revisions).

## 3. Roles & Permission Matrix

| Capability | reader | learner | contributor | reviewer | editor | admin |
|---|---|---|---|---|---|---|
| Browse/search/map | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quizzes/SRS/progress | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Propose edits, flag claims | | | ✓ | ✓ | ✓ | ✓ |
| Review/approve (unprotected) | | | | ✓ | ✓ | ✓ |
| Approve protected topics, vocabulary, merges | | | | | ✓ | ✓ |
| Bulk imports, rollback revisions | | | | | ✓ | ✓ |
| User/role management, protection settings, system config | | | | | | ✓ |

## 4. The Admin System (curation tooling)

Built as roadmap phases (Epoch 7 primarily), web-only:

- **Review workbench:** queue with AI briefs, side-by-side diff (structured +
  map-visual for geometry), one-click request-changes templates, batch review for
  imports.
- **Map/border editor:** draw/adjust border geometries with era context layers,
  snapping to existing geometry versions, topology warnings, certainty-class
  assignment, preview of resulting tiles across the affected time buckets.
- **Timeline editor:** adjust validity intervals with conflict visualization
  (overlapping primacy assertions highlighted).
- **Source & citation manager:** source registry CRUD, reliability classes,
  license gates, citation reuse search.
- **Version history everywhere:** every entity has a history tab; diff any two
  revisions; rollback with mandatory reason; bulk-import revisions reviewable and
  reversible as units.
- **Vocabulary & policy console:** relationship types, certainty classes, naming
  policy versions.
- **Coverage & quality dashboards:** doc 04 §7 metrics; review-latency SLOs;
  contributor funnel; AI-gate precision/recall against human outcomes.
- **Moderation:** flags queue, user reports, protection controls, tier management.

## 5. AI Policy (ADR-014 operationalized)

AI may: run the validation gate (§2), draft summaries/tour text *into review*,
suggest connections/quiz phrasing/distractors, detect inconsistencies and coverage
gaps, translate *into review*, and answer NL search by **retrieving and citing
canonical assertions only**.

AI may never: write canon, approve proposals, invent facts, dates, borders, or
sources, or present unlabeled generated text as fact.

Mechanics: every AI output stores prompt, model+version, retrieved context, and
output hash (auditable); generated drafts carry a visible `generated — pending
review` label in any UI that shows them; the NL answer surface is
retrieval-grounded with mandatory citation links and an abstain path ("Chronos
doesn't have sourced data on this yet") — abstention is always preferred over
plausibility. Gate quality is measured continuously against human review outcomes;
drift triggers re-evaluation before model upgrades roll out.

Privacy: learner data never enters model training; contribution text may be
processed for validation only.

## 6. Engineering Quality Doctrine

- **Testing pyramid per module:** unit (domain logic, property-based tests for
  historical-date and interval algebra), contract (module interfaces, GraphQL SDL
  snapshots, tile manifest), integration (curation pipeline end-to-end: propose →
  gate → approve → serving-plane invalidation), E2E smoke (instrument loads,
  scrub works, page renders, quiz answers record) on web and iOS.
- **Regression fixtures:** canonical "known worlds" (e.g., *Mediterranean 117 CE*,
  *Europe 1810*, *World 1938*, *World today*) — snapshot + tile + page output
  locked as golden files; any diff must be explained by a revision.
- **Temporal integrity suite** (doc 04 §7) runs in CI on fixtures and nightly on
  production.
- **Definition of Done for every roadmap phase:** acceptance criteria met; tests
  written and green; docs updated (architecture deltas land in these documents);
  CHANGELOG entry; roadmap status updated; migrations reversible; observability
  (metrics/logs) for new paths; zero known partially-implemented behavior left
  behind (feature-flag OFF is the only acceptable "partial").
- **Change control for bedrock:** assertion mixin, HistoricalDate spec, citation
  shape, contribution pipeline semantics — ADR + dedicated phase only.
- **Documentation system:** these numbered docs are living architecture docs;
  ADRs append-only; each module keeps a README (charter, interface, schema);
  generated schema/API reference published per release; GLOSSARY is binding
  vocabulary for code identifiers.

## 7. Release & Operations Governance

- Trunk-based development; every merge deployable; feature flags for incomplete
  surfaces; staged rollout (staging → canary → full).
- Serving-plane rebuilds are routine operations with dashboards (rebuild lag is a
  user-visible freshness metric).
- Backups: continuous WAL archiving + daily snapshots + quarterly restore drills;
  the canonical plane is the only thing that *must* survive anything.
- Incident policy: user-facing wrongness (bad data shown as fact) is an incident,
  not just downtime; postmortems feed the integrity suite.
