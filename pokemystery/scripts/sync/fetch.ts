/**
 * Fetch + normalize PokéAPI data into data/normalized/.
 *
 *   npm run data:fetch -- --range 1-151 --source mirror
 *
 * Flags:
 *   --range A-B    species id range (default 1-1025, the full national dex)
 *   --source S     api | mirror | auto (default auto: try api, fall back to mirror)
 *
 * Responses are cached in data/cache/, so interrupted runs resume where they
 * left off and reruns never re-download unchanged resources (delete the cache
 * to force a refresh).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PokeApiSource, mapConcurrent, type SourceName } from './source';
import { normalizeEvolutionChain, normalizePokemon, idFromUrl, type EvolutionLineInfo } from './normalize';
import type { RawEvolutionChain, RawPokemon, RawSpecies } from './pokeapi-types';
import type { PokemonRecord } from '../../shared/types';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const OUT_DIR = path.join(ROOT, 'data', 'normalized');
const MAX_SPECIES_ID = 1025; // national dex through generation 9
const CONCURRENCY = 10;

interface CliOptions {
  rangeStart: number;
  rangeEnd: number;
  source: SourceName | 'auto';
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { rangeStart: 1, rangeEnd: MAX_SPECIES_ID, source: 'auto' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--range') {
      const value = argv[++i];
      const match = value === undefined ? null : /^(\d+)-(\d+)$/.exec(value);
      if (!match) throw new Error('--range expects A-B, e.g. --range 1-151');
      options.rangeStart = Number(match[1]);
      options.rangeEnd = Math.min(Number(match[2]), MAX_SPECIES_ID);
      if (options.rangeStart < 1 || options.rangeStart > options.rangeEnd) {
        throw new Error(`invalid range ${options.rangeStart}-${options.rangeEnd}`);
      }
    } else if (arg === '--source') {
      const value = argv[++i];
      if (value !== 'api' && value !== 'mirror' && value !== 'auto') {
        throw new Error('--source expects api | mirror | auto');
      }
      options.source = value;
    }
  }
  return options;
}

async function pickSource(preference: SourceName | 'auto'): Promise<PokeApiSource> {
  if (preference !== 'auto') return new PokeApiSource(preference, CACHE_DIR);
  // Probe the live API first; fall back to the GitHub mirror.
  try {
    const probe = await fetch('https://pokeapi.co/api/v2/pokemon-species/1/', {
      signal: AbortSignal.timeout(8000),
    });
    if (probe.ok) return new PokeApiSource('api', CACHE_DIR);
  } catch {
    // unreachable — fall through
  }
  console.warn('pokeapi.co unreachable — using the PokeAPI/api-data GitHub mirror.');
  return new PokeApiSource('mirror', CACHE_DIR);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const source = await pickSource(options.source);
  const importedAt = new Date().toISOString();
  const ids = Array.from(
    { length: options.rangeEnd - options.rangeStart + 1 },
    (_, i) => options.rangeStart + i,
  );

  console.log(
    `Syncing species ${options.rangeStart}-${options.rangeEnd} from source "${source.name}"...`,
  );

  // 1. Species records.
  const species = await mapConcurrent(ids, CONCURRENCY, async (id) => {
    const record = await source.getJson<RawSpecies>('pokemon-species', id);
    return record;
  });

  // 2. Default-variety Pokémon records.
  const pokemon = await mapConcurrent(species, CONCURRENCY, async (sp) => {
    const defaultVariety = sp.varieties.find((v) => v.is_default);
    const pokemonId = defaultVariety ? idFromUrl(defaultVariety.pokemon.url) : sp.id;
    return source.getJson<RawPokemon>('pokemon', pokemonId);
  });

  // 3. Evolution chains (deduplicated).
  const chainIds = [
    ...new Set(
      species
        .filter((sp) => sp.evolution_chain !== null)
        .map((sp) => idFromUrl((sp.evolution_chain as { url: string }).url)),
    ),
  ];
  const chains = await mapConcurrent(chainIds, CONCURRENCY, (chainId) =>
    source.getJson<RawEvolutionChain>('evolution-chain', chainId),
  );
  const lines = new Map<number, EvolutionLineInfo>(
    chains.map((chain) => [chain.id, normalizeEvolutionChain(chain)]),
  );

  // 4. Starter lines: every member of a starter trio's evolution line.
  const startersRaw = await readFile(path.join(ROOT, 'data', 'curated', 'starters.json'), 'utf8');
  const starterBaseIds = (JSON.parse(startersRaw) as { starterBaseSpeciesIds: number[] })
    .starterBaseSpeciesIds;
  const starterLineIds = new Set<number>();
  for (const line of lines.values()) {
    if (starterBaseIds.some((id) => line.stageBySpecies.has(id) && line.stageBySpecies.get(id) === 1)) {
      // Only lines rooted at a starter base count (e.g. Pichu's line is not a starter line).
      const rootIsStarter = starterBaseIds.includes(rootSpeciesOf(line));
      if (rootIsStarter) starterLineIds.add(line.lineId);
    }
  }

  // 5. Normalize.
  const records: PokemonRecord[] = [];
  for (let i = 0; i < species.length; i += 1) {
    const sp = species[i];
    const pk = pokemon[i];
    if (sp === undefined || pk === undefined) continue;
    const chainId = sp.evolution_chain ? idFromUrl(sp.evolution_chain.url) : null;
    records.push(
      normalizePokemon({
        pokemon: pk,
        species: sp,
        line: chainId !== null ? (lines.get(chainId) ?? null) : null,
        starterLineIds,
        importedAt,
      }),
    );
  }

  // 6. Write normalized artifacts.
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'pokemon.json'),
    JSON.stringify(
      {
        meta: {
          source: source.name === 'api' ? 'pokeapi' : 'pokeapi-github-mirror',
          importedAt,
          rangeStart: options.rangeStart,
          rangeEnd: options.rangeEnd,
          count: records.length,
        },
        records,
      },
      null,
      1,
    ),
  );
  await writeFile(
    path.join(OUT_DIR, 'evolution.json'),
    JSON.stringify(
      {
        lines: [...lines.values()].map((line) => ({
          id: line.lineId,
          rootSpeciesId: rootSpeciesOf(line),
          maxStage: line.maxStage,
          isBranching: line.isBranching,
          speciesCount: line.speciesCount,
        })),
        edges: [...lines.values()].flatMap((line) => line.edges),
      },
      null,
      1,
    ),
  );

  console.log(
    `Done: ${records.length} Pokémon, ${lines.size} evolution lines. ` +
      `network=${source.stats.fromNetwork} cache=${source.stats.fromCache}`,
  );
}

function rootSpeciesOf(line: EvolutionLineInfo): number {
  for (const [speciesId, stage] of line.stageBySpecies) {
    if (stage === 1) return speciesId;
  }
  throw new Error(`Evolution line ${line.lineId} has no stage-1 species`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
