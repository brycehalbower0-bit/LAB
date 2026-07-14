/**
 * Validate the normalized dataset (data/normalized/ or --fixture).
 * Exits non-zero with a report when any check fails.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { PokemonRecord } from '../shared/types';
import { TYPE_NAMES } from '../shared/types';

const ROOT = path.join(import.meta.dirname, '..');

async function main(): Promise<void> {
  const fixture = process.argv.includes('--fixture');
  const dir = fixture ? path.join(ROOT, 'data', 'fixtures') : path.join(ROOT, 'data', 'normalized');
  const file = JSON.parse(await readFile(path.join(dir, 'pokemon.json'), 'utf8')) as {
    meta: { count: number; rangeStart: number; rangeEnd: number };
    records: PokemonRecord[];
  };
  const { records, meta } = file;
  const errors: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) errors.push(message);
  };

  check(records.length === meta.count, `meta.count ${meta.count} != records ${records.length}`);
  check(records.length > 0, 'dataset is empty');

  const validTypes = new Set<string>(TYPE_NAMES);
  const seenIds = new Set<number>();
  const seenNames = new Set<string>();

  for (const r of records) {
    const tag = `#${r.id} ${r.name}`;
    check(!seenIds.has(r.id), `${tag}: duplicate id`);
    seenIds.add(r.id);
    check(!seenNames.has(r.name), `${tag}: duplicate name`);
    seenNames.add(r.name);
    check(r.displayName.length > 0, `${tag}: empty displayName`);
    check(r.generation >= 1 && r.generation <= 9, `${tag}: bad generation ${r.generation}`);
    check(r.types.length >= 1 && r.types.length <= 2, `${tag}: bad type count`);
    check(
      r.types.every((t) => validTypes.has(t)),
      `${tag}: invalid type in ${r.types.join(',')}`,
    );
    check(r.primaryType === r.types[0], `${tag}: primaryType mismatch`);
    check(r.secondaryType === (r.types[1] ?? null), `${tag}: secondaryType mismatch`);
    check(r.heightDecimeters > 0, `${tag}: non-positive height`);
    check(r.weightHectograms > 0, `${tag}: non-positive weight`);
    check(r.baseStatTotal >= 150 && r.baseStatTotal <= 800, `${tag}: implausible BST ${r.baseStatTotal}`);
    check(r.abilities.length > 0, `${tag}: no abilities`);
    check(
      r.evolutionStage >= 1 && r.evolutionStage <= r.maximumEvolutionStage,
      `${tag}: stage ${r.evolutionStage}/${r.maximumEvolutionStage} inconsistent`,
    );
    check(!(r.canEvolve && r.evolutionStage === r.maximumEvolutionStage && !r.hasBranchingEvolution),
      `${tag}: canEvolve at max stage of non-branching line`);
    check(r.hasPreEvolution === (r.evolutionStage > 1), `${tag}: hasPreEvolution/stage mismatch`);
    check(
      r.genderRate === null || r.genderRate === -1 || (r.genderRate >= 0 && r.genderRate <= 8),
      `${tag}: bad genderRate ${String(r.genderRate)}`,
    );
    check(!(r.isBaby && r.isLegendary), `${tag}: baby+legendary`);
  }

  // Spot checks against well-known ground truth when in range.
  const byId = new Map(records.map((r) => [r.id, r]));
  const spot = (id: number, assert: (r: PokemonRecord) => boolean, description: string): void => {
    const r = byId.get(id);
    if (r !== undefined) check(assert(r), `spot-check failed: ${description}`);
  };
  spot(25, (r) => r.types.includes('electric'), 'Pikachu is Electric');
  spot(25, (r) => r.canEvolve && r.hasPreEvolution, 'Pikachu evolves and has a pre-evolution');
  spot(6, (r) => r.evolutionStage === 3 && !r.canEvolve, 'Charizard is a final stage-3');
  spot(1, (r) => r.isStarter, 'Bulbasaur is a starter');
  spot(150, (r) => r.isLegendary, 'Mewtwo is legendary');
  spot(151, (r) => r.isMythical, 'Mew is mythical');
  spot(133, (r) => r.hasBranchingEvolution, 'Eevee has branching evolution');
  spot(175, (r) => r.isBaby, 'Togepi is a baby');
  spot(149, (r) => r.generation === 1 && r.evolutionStage === 3, 'Dragonite is Gen 1 stage 3');

  if (errors.length > 0) {
    console.error(`VALIDATION FAILED — ${errors.length} error(s):`);
    for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
    if (errors.length > 50) console.error(`  ... and ${errors.length - 50} more`);
    process.exitCode = 1;
    return;
  }
  const generations = new Map<number, number>();
  for (const r of records) generations.set(r.generation, (generations.get(r.generation) ?? 0) + 1);
  console.log(`VALIDATION OK — ${records.length} records`);
  console.log(
    [...generations.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([generation, count]) => `gen${generation}:${count}`)
      .join(' '),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
