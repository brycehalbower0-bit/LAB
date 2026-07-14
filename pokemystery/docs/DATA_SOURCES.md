# Data Sources & Attribution

## PokéAPI

All Pokémon species data (names, types, dimensions, stats, abilities, egg
groups, colors, shapes, habitats, generation, legendary/mythical/baby flags,
evolution chains) comes from **[PokéAPI](https://pokeapi.co/)** — a free,
open, community-maintained Pokémon data API (BSD-3-Clause licensed data
pipeline; see https://github.com/PokeAPI/pokeapi).

The sync pipeline supports two interchangeable sources with identical
payloads:

| Source   | URL                                                        | Use                        |
| -------- | ---------------------------------------------------------- | -------------------------- |
| `api`    | `https://pokeapi.co/api/v2/`                               | Production default         |
| `mirror` | `https://raw.githubusercontent.com/PokeAPI/api-data/...`   | Official static mirror     |

`--source auto` (default) probes the live API and falls back to the mirror.
Games never query PokéAPI live — data is imported into D1 by
`npm run data:sync:local` / `data:sync:remote`.

## Sprites

Sprite and official-artwork URLs point at the
[PokeAPI/sprites](https://github.com/PokeAPI/sprites) GitHub repository, as
served through PokéAPI's own payloads. They are loaded client-side only when
a reveal is intended (after a correct guess / give-up), and can be disabled
entirely in settings (`showSpritesOnWin`).

## Curated data in this repository

- `data/curated/starters.json` — starter trios per generation. **Assumption:**
  "starter" means the classic grass/fire/water trios (all members of their
  evolution lines); Pikachu and Eevee (Yellow / Let's Go) are excluded.
- `data/curated/trait-assignments.json` — hand-curated subjective traits
  (cute, intimidating, feline, …). Objective body-plan and color traits are
  derived deterministically from PokéAPI shape/color/egg-group fields by
  `scripts/sync/derive-traits.ts`.

## Legal

PokéMystery is an unofficial fan project and is not affiliated with,
endorsed by, or sponsored by Nintendo, Game Freak, Creatures, or The Pokémon
Company. Pokémon and Pokémon character names are trademarks of Nintendo.
No official logos or proprietary artwork are bundled with this application.
