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
| 1     | D1 schema + migrations                                            | ⬜ Not started |
| 2     | Shared domain types + Zod schemas                                 | ⬜ Not started |
| 3     | Data import pipeline (PokéAPI sync, validate, seed)               | ⬜ Not started |
| 4     | Mode 1 engine: Bayesian guesser (entropy / information gain)      | ⬜ Not started |
| 5     | Mode 2 engine: deterministic NL parser + query evaluator          | ⬜ Not started |
| 6     | API worker: Hono routes, sessions, rate limiting, AI fallback     | ⬜ Not started |
| 7     | React frontend: landing, settings, both game modes, attribution   | ⬜ Not started |
| 8     | E2E tests, docs, deployment guide, final verification             | ⬜ Not started |

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

## Phase log

- **Phase 0** — scaffold verified: `tsc -b` ✅, `eslint .` ✅, `vite build` ✅.
