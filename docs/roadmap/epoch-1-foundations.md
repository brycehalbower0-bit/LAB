# Epoch 1 — Foundations (Phases 1–12)

**Theme:** the machine that builds the machine. No public features; every later
epoch stands on these phases. Exit state: monorepo with CI/CD and environments,
the temporal bedrock libraries and schemas, the curation write-path, API/web
skeletons, auth, and observability.

Phase entry format: Objective · Requirements · Acceptance criteria · DB / API /
Frontend work · Testing · Docs · Depends on · Risks · Future · Estimate.

---

### Phase 1 — Project charter, monorepo & engineering standards — `DONE (2026-07-09)`

> Completion notes: acceptance met — `pnpm install && pnpm check` green (lint,
> typecheck, tests, boundary check + selftest on seeded violations); CI workflow
> runs the identical command; README quickstart accurate. Deviations: commit
> conventions documented in CONTRIBUTING.md rather than tooling-enforced
> (over-tooling guard); CLA is a draft pending legal review (flagged to owner).

**Objective.** Turn the blueprint into an operational project: repo layout, standards, licenses, contribution legal groundwork.
**Requirements.** Monorepo (`/docs /packages /apps /ios /pipelines /infra /data`); pnpm workspaces + turborepo; lint/format/typecheck baseline; commit conventions; module-boundary lint (dependency-cruiser) configured with the doc 01 module graph; LICENSE files (AGPL-3.0 code, CC BY-SA content — ADR-013); CLA text and process; CODEOWNERS; issue/PR templates referencing the Definition of Done.
**Acceptance.** Fresh clone → `pnpm install && pnpm check` green in CI; a PR violating a module boundary fails CI; README quickstart accurate.
**DB.** — **API.** — **Frontend.** —
**Testing.** CI itself (meta): standards checks run on a seeded violation fixture.
**Docs.** CONTRIBUTING.md; engineering-standards doc; update README status.
**Depends on.** Blueprint (this repo). **Risks.** Over-tooling; keep to what enforces the blueprint. **Future.** Swift toolchain added in Phase 72.
**Estimate.** 1 week.

### Phase 2 — CI/CD, environments & infrastructure as code — `PLANNED`

**Objective.** Reproducible dev/staging environments and a deploy pipeline before there is anything to deploy.
**Requirements.** Docker images per app; docker-compose local stack (Postgres+PostGIS, Redis, MinIO); Terraform/OpenTofu for staging (managed Postgres, container runtime, S3-compatible storage, CDN); GitHub Actions: check → build → deploy-staging; secrets management; preview deploys optional.
**Acceptance.** `docker compose up` yields a working local stack; merge to main auto-deploys a hello-world API to staging behind TLS; infra reproducible from scratch via IaC in <1 hour.
**DB.** Provisioned. **API.** Hello-world/health. **Frontend.** —
**Testing.** Pipeline smoke test; IaC plan drift check in CI.
**Docs.** infra README + runbook (bootstrap, teardown, secrets).
**Depends on.** P1. **Risks.** Provider lock-in — mitigated by IaC + containers (ADR-012). **Future.** Production env stood up in Epoch 8.
**Estimate.** 2 weeks.

### Phase 3 — Database foundation & migration framework — `PLANNED`

**Objective.** The system-of-record skeleton: Postgres with per-module schemas, migration discipline, and role separation.
**Requirements.** Postgres 17 + PostGIS + pgvector images/extensions; migration tool (per-module directories, forward-only, reviewed); DB roles: `app_read`, `app_write_curation` (only curation may write canonical schemas — doc 08 §2 rule 1), `pipeline_stage`; connection pooling; seed/fixture loader.
**Acceptance.** `pnpm db:migrate` builds all module schemas from zero; role separation proven by a test that non-curation writes to a canonical table fail; PostGIS query works in CI.
**DB.** `core`, `curation`, `identity`, `telemetry` schemas created (empty shells).
**API.** — **Frontend.** —
**Testing.** Migration up-from-zero in CI; role-permission tests.
**Docs.** Migration policy doc (expand→backfill→contract); schema-docs generation stub.
**Depends on.** P2. **Risks.** Getting role separation wrong now = unenforceable later. **Future.** Partitioning policies (doc 03 §10) applied when tables arrive.
**Estimate.** 1.5 weeks.

### Phase 4 — Entity registry & identifier system — `PLANNED`

**Objective.** Implement `core.entity`, public IDs, slugs, merges/redirects, external ID cross-references (ADR-008; doc 03 §2).
**Requirements.** ULID generation; prefixed public IDs per kind; `entity_name` (multilingual, dated, typed) and `external_id` tables; merge semantics (status `merged`, permanent redirect) as pure functions ready for curation integration.
**Acceptance.** Create/read/merge entities via internal service API; redirect resolution honored; property tests for ID uniqueness/stability; external-ID lookup by QID works.
**DB.** `core.entity`, `core.entity_name`, `core.external_id` + enums.
**API.** Internal module interface only. **Frontend.** —
**Testing.** Property-based ID tests; merge/redirect unit tests.
**Docs.** Identifier spec (language-neutral, for Python/Swift mirrors).
**Depends on.** P3. **Risks.** Under-modeling names (they are assertions too — dated/sourced from day one). **Future.** Name rendering-at-T in Epoch 3.
**Estimate.** 1.5 weeks.

### Phase 5 — `historical-date` library (the time bedrock) — `PLANNED`

**Objective.** Implement ADR-015 / doc 03 §3: ordinals, precision, bounds, calendars, formatting, interval algebra — in TypeScript and Python, from one spec.
**Requirements.** JSON Schema + prose spec; TS package `@chronos/historical-date`; Python mirror `chronos_historical_date`; golden test vectors shared by both (later Swift); parsing of human input ("c. 750 BCE", "1848", "1914-06-28", "8th century"); Julian↔Gregorian conversion; interval algebra (overlap, containment, generous-range materialization); DB serialization helpers (`int8range`).
**Acceptance.** Both implementations pass identical golden vectors (≥300 cases incl. BCE, calendar edges, precision arithmetic); round-trip guarantees; documented formatting for every precision incl. uncertainty ("between 1235 and 1241").
**DB.** Column-set convention + generated `valid_range` helper (used from P6).
**API.** Custom GraphQL scalar defined (used from P9). **Frontend.** Formatting util shared.
**Testing.** Property-based (ordering, conversion round-trips); golden vectors are the permanent cross-language contract.
**Docs.** The HistoricalDate spec (normative appendix to doc 03).
**Depends on.** P1. **Risks.** Highest-leverage code in the project — budget review time; calendar edge cases (Julian leap rules, year-0) must be sourced carefully.
**Future.** Swift implementation (P72); season precision refinements.
**Estimate.** 2.5 weeks.

### Phase 6 — Assertion framework, sources & citations — `PLANNED`

**Objective.** The knowledge atom: assertion mixin, interpretation/primacy/confidence, source entities, citations, live views (doc 03 §4).
**Requirements.** SQL mixin generator/macros for assertion tables; `core.citation`; source entities with reliability class + license record (doc 04 §4/§6); `*_live` view convention; temporal-consistency check helpers (interval sanity, primacy overlap detection).
**Acceptance.** A demo assertion table (test-only) supports: parallel conflicting assertions, primacy selection, citation requirement for `accepted`, generous-range temporal queries returning uncertain rows; schema docs generate.
**DB.** `core.source` detail, `core.citation`, enums (`interpretation`, `support`), mixin conventions.
**API.** Internal `Asserted` shape defined for later GraphQL exposure. **Frontend.** —
**Testing.** Property tests for interval/primacy invariants; citation-gate tests.
**Docs.** Assertion authoring guide (how every future module defines tables).
**Depends on.** P4, P5. **Risks.** Bedrock (change-controlled hereafter, doc 08 §6). **Future.** Bitemporal filters wired in P7.
**Estimate.** 2 weeks.

### Phase 7 — Curation kernel: revisions, propose→commit, rollback — `PLANNED`

**Objective.** The only write path: proposals, structured diffs, transactional commit with revision records, inverse-revision rollback (doc 03 §8). Internal/service callers only for now.
**Requirements.** `curation.revision`, `curation.revision_change`; propose/validate/commit service; retire-and-replace mechanics on assertion tables (`created_rev`/`retired_rev`); rollback as inverse revision; record-time ("as of rev R") query helpers; mechanical validation hooks (schema, interval sanity, citation presence).
**Acceptance.** End-to-end: propose a change set → commit → live views reflect it → rollback restores exactly, with full history queryable; "as-of" queries reproduce pre-change reads; direct table writes without a revision are impossible (role test from P3 extended).
**DB.** Curation schema tables; triggers/constraints enforcing revision discipline.
**API.** Internal service interface (GraphQL mutations arrive P9/Epoch 7). **Frontend.** —
**Testing.** Round-trip commit/rollback property tests; concurrency (two proposals touching one assertion) semantics defined and tested.
**Docs.** Curation kernel spec; write-path invariants added to doc 08.
**Depends on.** P6. **Risks.** Concurrency semantics; keep first version conservative (serialized commits).
**Future.** AI gate (P83) and public proposals (P84) plug into this unchanged.
**Estimate.** 2.5 weeks.

### Phase 8 — Domain event bus & worker skeleton — `PLANNED`

**Objective.** Transactional outbox + Redis streams + idempotent worker framework (ADR-011) so the serving plane can exist.
**Requirements.** Outbox table written in curation commit transaction (enforced, not optional — doc 01 §6); relay process; BullMQ queues; worker app skeleton with retry/dead-letter, idempotency keys, metrics.
**Acceptance.** Committing a revision emits `entity.changed` exactly-once-in-effect to a demo consumer under kill/retry chaos tests; dead-letter and replay runbook works.
**DB.** `curation.outbox`. **API.** — **Frontend.** —
**Testing.** Chaos/idempotency integration tests in CI.
**Docs.** Event catalog started (name, payload, consumers).
**Depends on.** P7. **Risks.** Silent event loss would rot caches forever — hence enforcement in the commit path.
**Future.** Snapshot/tile/search/quiz consumers in later epochs.
**Estimate.** 1.5 weeks.

### Phase 9 — API skeleton: modular monolith & GraphQL gateway — `PLANNED`

**Objective.** The `chronos-api` NestJS application: module scaffolding per doc 01 §2, GraphQL server, HistoricalDate scalar, error conventions, request observability.
**Requirements.** Nest module per blueprint module (empty charters OK); code-first GraphQL; `node(id)` + redirect resolution; persisted-query plumbing; typed error extensions (doc 05 §8); correlation IDs; rate limiting baseline.
**Acceptance.** `entity(id)` resolves registry entities incl. merge redirects; SDL snapshot test in CI; p95 overhead <20ms on staging echo queries; module-boundary lint covers API code.
**DB.** — **API.** Gateway + `entity` query live on staging. **Frontend.** —
**Testing.** SDL snapshot; resolver integration tests; error-shape contract tests.
**Docs.** API conventions doc (doc 05 operationalized).
**Depends on.** P4, P5, P8. **Risks.** GraphQL N+1 patterns — dataloader conventions set now.
**Future.** Every module adds resolvers to this gateway.
**Estimate.** 2 weeks.

### Phase 10 — Identity, auth & roles — `PLANNED`

**Objective.** Accounts, OIDC login, JWT sessions, role model (doc 08 §3), preferences.
**Requirements.** OIDC (Auth Code + PKCE) with a managed IdP behind an abstraction; `identity` schema; roles `reader…admin` in token claims; GraphQL guard decorators; account deletion/export stubs (GDPR posture from day one, doc 03 §9).
**Acceptance.** Sign up/in/out on staging; role-guarded test mutation rejects insufficient roles; deletion removes personal data and is tested.
**DB.** `identity.user`, roles, preferences. **API.** Auth mutations/queries; guards. **Frontend.** Minimal login UI (in P11 shell).
**Testing.** AuthZ matrix tests generated from the doc 08 table.
**Docs.** Security & privacy baseline doc.
**Depends on.** P9. **Risks.** IdP lock-in — abstraction + standard OIDC only.
**Future.** Reputation tiers (P86) extend this role model.
**Estimate.** 1.5 weeks.

### Phase 11 — Web app skeleton & design system seed — `PLANNED`

**Objective.** The `web` app: Vite+React+TanStack shell, GraphQL client with codegen, design tokens, first components, Storybook (ADR-010).
**Requirements.** Routing shell (instrument route, entity route, account route — placeholders); Zustand store shaped for (T, viewport, layers, selection); design tokens (color/type/space/motion + cartographic palette placeholders); base components (button, card, dialog, provenance-popover shell); a11y linting; Storybook deployed from CI.
**Acceptance.** Login round-trip works against staging API; `entity/:id` renders registry data end-to-end; Lighthouse a11y ≥95 on shell; Storybook published.
**DB.** — **API.** Consumes P9/P10. **Frontend.** Everything above.
**Testing.** Component tests; one Playwright E2E (login → entity page) in CI.
**Docs.** Frontend architecture README; design-token reference.
**Depends on.** P9, P10. **Risks.** Premature design-system elaboration — seed only what P18–22 need.
**Future.** Map instrument lands P18; tokens exported for iOS in P72.
**Estimate.** 2 weeks.

### Phase 12 — Observability, backups & Epoch 1 review — `PLANNED`

**Objective.** Operations floor: metrics/logs/traces, immutable audit log, backup/restore, then the first formal architecture audit.
**Requirements.** OpenTelemetry across api/workers; dashboards (latency, errors, queue depth, DB health); `telemetry.audit_log` (append-only) capturing auth and curation actions; WAL archiving + daily snapshots + tested restore; on-call-lite alerting; **epoch review**: audit docs 00–08 against built reality, revise Epoch 2 phases, changelog + roadmap statuses.
**Acceptance.** Staged restore drill from backup passes; a curation commit is traceable end-to-end in dashboards; epoch review notes merged; all Epoch 1 phases marked DONE with dates/revs.
**DB.** `telemetry.audit_log`. **API.** Health/readiness finalized. **Frontend.** —
**Testing.** Restore drill scripted; alert test.
**Docs.** Operations runbook v1; Epoch 1 review report; CHANGELOG.
**Depends on.** P1–P11. **Risks.** Skipping the review under schedule pressure — it is the charter's control loop.
**Future.** Drills recur quarterly (P97 formalizes DR).
**Estimate.** 1.5 weeks.

---

**Epoch 1 total: ~21 weeks (≈5 months).**
