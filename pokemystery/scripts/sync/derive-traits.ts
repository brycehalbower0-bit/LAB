/**
 * Deterministic trait derivation from normalized PokéAPI data, plus merging
 * of hand-curated assignments. Pure functions — unit-testable.
 */

import type { PokemonRecord } from '../../shared/types';

export interface TraitAssignment {
  pokemonId: number;
  traitKey: string;
  confidence: number;
  source: string;
}

/** PokéAPI shape slug -> derived trait confidences. */
const SHAPE_TRAITS: Record<string, [traitKey: string, confidence: number][]> = {
  quadruped: [['four-legged', 0.95]],
  upright: [
    ['bipedal', 0.9],
    ['has-arms', 0.7],
  ],
  humanoid: [
    ['bipedal', 0.95],
    ['humanoid', 0.9],
    ['has-arms', 0.95],
  ],
  wings: [['has-wings', 0.95]],
  'bug-wings': [
    ['has-wings', 0.95],
    ['insectoid', 0.9],
  ],
  squiggle: [['serpentine', 0.85]],
  fish: [['fish-like', 0.9]],
  ball: [['round-body', 0.9]],
  blob: [['round-body', 0.75]],
  tentacles: [['has-tentacles', 0.9]],
  arms: [['has-arms', 0.9]],
  legs: [['insectoid', 0.6]],
  armor: [['four-legged', 0.4]],
  heads: [['round-body', 0.5]],
};

const COLOR_TRAITS: Record<string, string> = {
  red: 'mostly-red',
  blue: 'mostly-blue',
  yellow: 'mostly-yellow',
  green: 'mostly-green',
  pink: 'mostly-pink',
  purple: 'mostly-purple',
  brown: 'mostly-brown',
  black: 'mostly-black',
  white: 'mostly-white',
  gray: 'mostly-gray',
};

export function deriveTraits(pokemon: PokemonRecord): TraitAssignment[] {
  const out: TraitAssignment[] = [];
  const add = (traitKey: string, confidence: number, source: string): void => {
    out.push({ pokemonId: pokemon.id, traitKey, confidence, source });
  };

  if (pokemon.shape !== null) {
    for (const [traitKey, confidence] of SHAPE_TRAITS[pokemon.shape] ?? []) {
      add(traitKey, confidence, 'derived:shape');
    }
  }
  if (pokemon.color !== null) {
    const colorTrait = COLOR_TRAITS[pokemon.color];
    if (colorTrait !== undefined) add(colorTrait, 0.9, 'derived:color');
  }
  if (pokemon.types.includes('dragon')) {
    add('dragon-like', 0.9, 'derived:type');
  } else if (pokemon.eggGroups.includes('dragon')) {
    add('dragon-like', 0.6, 'derived:egg-group');
  }
  if (pokemon.eggGroups.includes('flying') && pokemon.shape === 'wings') {
    add('bird-like', 0.75, 'derived:egg-group');
  }
  return out;
}

/**
 * Merge derived and curated assignments. Curated entries win on conflict
 * (they carry human judgment); evidence_count reflects agreeing sources.
 */
export function mergeAssignments(
  derived: TraitAssignment[],
  curated: TraitAssignment[],
): (TraitAssignment & { evidenceCount: number })[] {
  const byKey = new Map<string, TraitAssignment & { evidenceCount: number }>();
  for (const assignment of derived) {
    byKey.set(`${assignment.pokemonId}:${assignment.traitKey}`, {
      ...assignment,
      evidenceCount: 1,
    });
  }
  for (const assignment of curated) {
    const key = `${assignment.pokemonId}:${assignment.traitKey}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      ...assignment,
      evidenceCount: existing !== undefined ? existing.evidenceCount + 1 : 1,
    });
  }
  return [...byKey.values()];
}
