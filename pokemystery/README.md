# PokéMystery

An unofficial Pokémon guessing game for Cloudflare Workers, inspired by
Akinator and Twenty Questions.

- **AI Guesses Your Pokémon** — think of a Pokémon; a Bayesian engine asks
  information-optimal yes/no questions until it names it.
- **You Guess the Pokémon** — the server picks a secret Pokémon; ask questions
  in plain English ("Is it a Water type?", "Is it taller than 1 meter?",
  "Is it Dragonair?") and deduce it.

Built on **Cloudflare Workers + Workers Static Assets + D1**, with React 19,
Vite, Hono, Zod, TypeScript strict mode, Vitest, and Playwright. No Node.js
server; no Express. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)
for the full build log and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for
attribution.

## Quickstart

```bash
npm install
npm run db:migrate:local     # create the local D1 schema
npm run data:sync:local      # import the full national dex into local D1
npm run dev                  # Vite + Workers runtime on http://localhost:5173
```

Prefer a tiny offline dataset? `npm run data:seed:test` loads the committed
Gen 1 fixture instead of fetching anything. (Both loaders are upserts — to
start truly clean, delete `.wrangler/state` and re-run migrations.)

## Commands

| Command                    | What it does                                             |
| -------------------------- | -------------------------------------------------------- |
| `npm run dev`              | Local dev server (frontend + Worker + local D1)          |
| `npm run check`            | typecheck + lint + unit tests + build                    |
| `npm run test` / `test:e2e`| Vitest suite / Playwright end-to-end suite               |
| `npm run db:migrate:local` | Apply D1 migrations locally (`:remote` for production)   |
| `npm run data:fetch`       | Fetch + normalize PokéAPI data (`-- --range 1-151`)      |
| `npm run data:sync:local`  | Fetch → generate SQL → load local D1                     |
| `npm run data:sync:remote` | Same against the production D1 (needs wrangler auth)     |
| `npm run data:validate`    | Validate the normalized dataset                          |
| `npm run data:seed:test`   | Load the committed Gen 1 fixture (no network)            |
| `npm run deploy`           | Build and `wrangler deploy`                              |

## Deployment

1. `wrangler login` (or set `CLOUDFLARE_API_TOKEN`).
2. `wrangler d1 create pokemystery-db` and paste the returned `database_id`
   into `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. `npm run data:sync:remote` — bulk-loads the dataset via
   `wrangler d1 execute --remote --file`, the supported bulk path for D1.
5. `npm run deploy`

Optional: enable the Workers AI fallback parser by uncommenting the `ai`
binding in `wrangler.jsonc`, setting `AI_PARSER_ENABLED=true` (a var or
`.dev.vars`), and re-running `wrangler types`. The deterministic parser
always runs first; the model only maps unparsed text to a structured query —
it is never the authority on Pokémon facts.

## Architecture in one paragraph

`shared/` holds all business logic as pure TypeScript (no React, DOM, Node,
or Cloudflare APIs): the domain model, a Zod-validated `StructuredQuery`
union, a deterministic evaluator over normalized Pokédex data, a Bayesian
guessing engine (entropy / information-gain question selection), and a
rule-based natural-language parser. The Worker (`worker/`, Hono) owns game
sessions in D1 — including Mode 2's secret, which never leaves the server —
validates every input with Zod, uses prepared statements everywhere, and
rate-limits the parsing endpoint. The React frontend (`src/`) is a thin
client over the JSON API, served as static assets by the same Worker.

## Legal

PokéMystery is an unofficial fan project and is not affiliated with, endorsed
by, or sponsored by Nintendo, Game Freak, Creatures, or The Pokémon Company.
Data and sprites come from [PokéAPI](https://pokeapi.co/); no official logos
or proprietary artwork are bundled. The product name is configurable via the
`APP_NAME` var.
