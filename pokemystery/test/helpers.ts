/** Shared test helpers: fixture loading and synthetic candidates. */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CandidatePokemon, PokemonRecord, TraitMap } from '../shared/types';
import { TRAIT_KINDS } from '../shared/traits';
import { deriveTraits } from '../scripts/sync/derive-traits';
import type { EvaluationContext } from '../shared/engine/evaluate';

const FIXTURE_DIR = path.join(__dirname, '..', 'data', 'fixtures');

export function loadFixturePokemon(): CandidatePokemon[] {
  const file = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'pokemon.json'), 'utf8')) as {
    records: PokemonRecord[];
  };
  return file.records.map((record) => {
    const traits: Record<string, number> = {};
    for (const assignment of deriveTraits(record)) {
      traits[assignment.traitKey] = assignment.confidence;
    }
    return { record, traits };
  });
}

export const testEvaluationContext: EvaluationContext = {
  traitKinds: TRAIT_KINDS,
};

/** Minimal synthetic Pokémon for focused engine tests. */
export function syntheticCandidate(
  id: number,
  overrides: Partial<PokemonRecord> = {},
  traits: TraitMap = {},
): CandidatePokemon {
  return {
    record: {
      id,
      name: `mon-${id}`,
      displayName: `Mon ${id}`,
      generation: 1,
      speciesId: id,
      defaultFormName: null,
      primaryType: 'normal',
      secondaryType: null,
      types: ['normal'],
      heightDecimeters: 10,
      weightHectograms: 100,
      baseExperience: 100,
      baseStatTotal: 400,
      abilities: ['run-away'],
      eggGroups: ['field'],
      color: 'red',
      shape: 'quadruped',
      habitat: null,
      growthRate: 'medium',
      genderRate: 4,
      isBaby: false,
      isLegendary: false,
      isMythical: false,
      isStarter: false,
      hasPreEvolution: false,
      canEvolve: true,
      evolutionStage: 1,
      maximumEvolutionStage: 2,
      evolutionLineId: id,
      hasBranchingEvolution: false,
      spriteUrl: null,
      officialArtworkUrl: null,
      importedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
    traits,
  };
}
