# PokéMystery — Implementation Status

An unofficial Pokémon guessing game (Akinator-style) built for Cloudflare
Workers + Static Assets + D1. This document tracks phase-by-phase progress and
records the assumptions and decisions made along the way.

**Verification bar for every phase:** `npm run typecheck`, `npm run lint`,
`npm run test`, and `npm run build` must all pass before a phase is marked
complete.

## Phase overview

| Phase | Scope                                                             | Status         |
| ----- | ----------------------------------------------------------------- | -------------- |
| 0     | Project scaffold: Vite + React + Worker + Wrangler + lint/test    | ✅ Complete    |
| 1     | D1 schema + migrations                                            | ✅ Complete    |
| 2     | Shared domain types + Zod schemas                                 | ✅ Complete    |
| 3     | Data import pipeline (PokéAPI sync, validate, seed)               | ✅ Complete    |
| 4     | Mode 1 engine: Bayesian guesser (entropy / information gain)      | ✅ Complete    |
| 5     | Mode 2 engine: deterministic NL parser + query evaluator          | ✅ Complete    |
| 6     | API worker: Hono routes, sessions, rate limiting, AI fallback     | ✅ Complete    |
| 7     | React frontend: landing, settings, both game modes, attribution   | ✅ Complete    |
| 8     | E2E tests, docs, deployment guide, final verification             | ✅ Complete    |

## Phase 0 — Scaffold (complete)

- Standalone project at `pokemystery/` in the lab monorepo. It is deliberately
  **outside** the Chronos pnpm workspace (`packages/*`, `apps/*`) and uses npm,
  so the two projects never entangle.
- Stack: Vite 6 + React 19 + TypeScript strict, Cloudflare Vite plugin,
  Hono on a Cloudflare Worker, Workers Static Assets
  (`single-page-application` not-found handling), Wrangler 4, Vitest 3,
  ESLint 9 (type-checked, `no-explicit-any` = error).
- `wrangler types` generates `worker-configuration.d.ts` from `wrangler.jsonc`
  so Worker bindings (`DB`, `AI`, `ASSETS`, vars) are always typed from real
  configuration.
- Three TS projects: `src` (DOM/React), `worker` + `shared` + `test`
  (workerd types, no DOM), `scripts`/`e2e` (Node). `shared/` must stay free of
  React, DOM, and Node APIs — it is compiled by both app and worker configs.
- `.dev.vars.example` documents optional AI parser vars; no secrets committed.

### Assumptions / decisions

- **Location**: "a folder in the lab repository as a standalone project" →
  top-level `pokemystery/` directory with its own package.json and lockfile.
- **Network policy**: this dev environment cannot reach `pokeapi.co` (proxy
  403) but CAN reach `raw.githubusercontent.com`. The data pipeline therefore
  supports two sources: the live PokéAPI (production default) and the official
  PokéAPI static-data mirror `PokeAPI/api-data` on GitHub (same JSON payloads,
  maintained by the PokéAPI team). Source is selectable via CLI flag.
- **D1 database id** in `wrangler.jsonc` is a placeholder; real deploys must
  run `wrangler d1 create pokemystery-db` and paste the UUID (documented in
  DEPLOYMENT docs, Phase 8).
- Product name **PokéMystery** is configurable via the `APP_NAME` var.

## Phase 1 — D1 schema (complete)

`migrations/0001_init.sql`: pokemon (+pokemon_types), evolution_lines/edges,
traits + pokemon_traits (confidence/source/evidence/review), questions
(+question_matches), game_sessions/answers/guesses, question_parse_logs,
correction_reports, import_runs. FKs, CHECK-guarded enums, indexes. Species
are the play unit; forms can be added later as extra pokemon rows sharing
species_id (default_form_name marks them).

## Phase 2 — Shared layer (complete)

`shared/` (no React/DOM/Node/CF APIs): domain types, GameSettings +
defaults, StructuredQuery discriminated union (Zod), the deterministic
evaluator (single authority on facts; returns match probabilities in [0,1],
0.5 = unknown), API schemas/response types, trait catalog.

## Phase 3 — Data pipeline (complete)

- `npm run data:fetch [-- --range A-B --source api|mirror|auto]` — fetches
  species + default-variety pokemon + deduplicated evolution chains with
  concurrency 10, retry w/ backoff, and a disk cache making interrupted runs
  resumable and reruns request-free. Normalizes to `data/normalized/`.
- `npm run data:sync:local` / `data:sync:remote` — fetch → build idempotent
  INSERT OR REPLACE SQL batches → `wrangler d1 execute` (+ import_runs row;
  failures recorded with status='failed').
- `npm run data:validate` — invariant checks + ground-truth spot checks.
- `npm run data:seed:test` — loads the committed Gen 1 fixture
  (`data/fixtures/`) without any network.
- **Full national dex (1025 species, gens 1–9) synced from the PokéAPI
  GitHub mirror, validated, committed to `data/normalized/`, and loaded into
  local D1**: 1025 pokemon, 2925 trait assignments, 484 evolution edges,
  73 questions.
- Traits: objective body/color traits derived from shape/color/egg-group;
  subjective traits hand-curated (~180 assignments). See docs/DATA_SOURCES.md.

## Phase 4 — Mode 1 engine (complete)

Pure functions in `shared/engine/`: Bayesian updates from the configurable
ANSWER_LIKELIHOODS table (candidates never hit zero), Shannon entropy,
expected-entropy/information-gain question values, scoring with reliability
discount + category-repetition penalty + unbalanced-question penalty +
priority tweaks, guess policy (threshold 0.82, 2.5× lead, perplexity ≤ 2.5,
low remaining gain, question budget), rejected-guess crushing without
elimination, undo-by-replay, and contradiction analysis for the end-of-game
report. **Tuning note:** an absolute "plausible candidate" cutoff broke with
large uniform pools; replaced with distribution perplexity (2^entropy).

Tests (21 passing): entropy/update/gain properties, balanced-vs-unbalanced
preference fixture, category-repeat penalty, guess-once-confident, no
repeat guesses, undo restoration, contradiction detection, and full-game
simulations on the real Gen 1 fixture — win rate ≥ 90% against a truthful
player within 20 questions.

## Phase 5 — NL parser (complete)

`shared/parser/`: lexicon (type/region/color/trait/unit aliases,
contractions) + ordered rule matchers. Handles every phrasing mandated in the
spec, negation ("is it not…", "isn't it…"), unit conversion (m/cm/ft/kg/lb…),
vague sizes, typo-tolerant name guesses (capped Levenshtein), and returns a
human-readable "interpreted" restatement for UI transparency. Unparseable
input → null → optional AI fallback → "please rephrase".

## Phase 6 — API worker (complete)

Hono routes over D1 sessions (opaque 256-bit tokens, 24 h expiry):

- `POST /api/games` — both modes; settings validated server-side.
- Mode 1: `/answer`, `/guess-response`, `/undo`, `/reveal` (contradiction
  report). Engine state serialized server-side; undo replays history.
- Mode 2: `/ask` (deterministic parser → optional Workers AI → rephrase),
  `/guess`, `/hint` (gen → type → first letter), `/giveup`. Name-guess
  questions consume guess slots (difficulty: easy 5 / normal 3 / hard 2).
- `GET /api/games/:id` (no secrets), `/api/meta`, `/api/pokemon/names`,
  `POST /api/reports` (stored for review; never auto-edits canonical data).
- Zod on every input, prepared statements on every query, ask endpoint
  rate-limited 20/min/session, parse logs + import runs recorded.
- **Secret never serialized to the client** until win/loss/give-up.
- Workers AI binding is opt-in (commented in wrangler.jsonc) because remote
  bindings require Cloudflare credentials during `vite dev`. The AI fallback
  only maps text → StructuredQuery (schema-validated, identifier kinds
  forbidden); the deterministic evaluator answers everything.

## Phase 7 — Frontend (complete)

React 19 SPA (hash routing, no router dep): landing with two mode cards +
how-to-play, settings page (generations, legendary/mythical/baby/forms,
difficulty, max questions, hints, sprites), both game UIs (Mode 1: big
question card, 5 answer buttons, undo, guess confirmation, defeat →
name-autocomplete reveal → contradictions + report; Mode 2: chat log with
answer pills and interpretations, example-question chips, hints, direct
guessing, give-up reveal), about/attribution page. Dark/light/system themes
(pre-paint script avoids flash), `prefers-reduced-motion` honored, aria-live
game announcements, keyboard-operable throughout, mobile-first CSS.
Verified visually via Playwright screenshots (light desktop + dark mobile).

## Phase 8 — E2E, docs, verification (complete)

- Playwright suite (6 tests, all passing) against the real dev server +
  seeded local D1: landing/theme/settings persistence, Mode 1
  question/undo/full-game-to-resolution, Mode 2
  ask/rephrase/hint/guess/give-up.
- README (quickstart, commands, deployment runbook), DATA_SOURCES.
- Final verification: `npm run check` (typecheck ✅ lint ✅ 38 unit tests ✅
  build ✅) + `npm run test:e2e` (6 ✅) + fixture seed + full-dex reload.

## Known limitations / future work

- Alternate forms: schema-ready (`species_id` + `default_form_name`), not
  yet imported; the settings toggle is visible but disabled.
- `question_matches` (precomputed match probabilities) exists but is unused —
  runtime evaluation of 73 questions × ≤1025 candidates is fast enough.
- Popularity-weighted priors are supported by design (uniform priors today).
- Difficulty currently affects only direct-guess allowance in Mode 2.
- `data:seed:test` and sync loads are upserts; they don't delete rows
  outside the imported range.

## Phase log

- **Phase 0** — scaffold verified: `tsc -b` ✅, `eslint .` ✅, `vite build` ✅.
- **Phases 1–4** — verified: `tsc -b` ✅, `eslint .` ✅, `vitest run` (21) ✅,
  `vite build` ✅, full-dex import into local D1 ✅.
- **Phase 5** — verified: `vitest run` (38) ✅ incl. all mandated parser
  examples.
- **Phase 6** — verified: typecheck/lint/tests/build ✅ + live smoke test of
  both modes via `vite dev` + curl against local D1 (Mode 2 secret was
  Nidoran♀; every answer matched ground truth; no secret leakage).
- **Phases 7–8** — verified: full `npm run check` ✅, `npm run test:e2e`
  (6 Playwright tests) ✅, screenshots reviewed in light/desktop and
  dark/mobile.
