/**
 * Trait catalog. Objective traits are derived deterministically from PokéAPI
 * shape/color/egg-group data by the sync pipeline; subjective traits are
 * curated by hand in data/curated/trait-assignments.json.
 */

import type { TraitKind } from './engine/evaluate';

export interface TraitDefinition {
  key: string;
  label: string;
  kind: TraitKind;
  description: string;
}

export const TRAIT_DEFINITIONS: readonly TraitDefinition[] = [
  // Body plan (derived from pokeapi shape)
  { key: 'four-legged', label: 'Four-legged', kind: 'objective', description: 'Walks on four legs' },
  { key: 'bipedal', label: 'Bipedal', kind: 'objective', description: 'Stands on two legs' },
  { key: 'has-wings', label: 'Has wings', kind: 'objective', description: 'Has visible wings' },
  { key: 'serpentine', label: 'Serpentine', kind: 'objective', description: 'Snake-like body' },
  { key: 'fish-like', label: 'Fish-like', kind: 'objective', description: 'Fish-shaped, fins' },
  { key: 'humanoid', label: 'Humanoid', kind: 'objective', description: 'Human-like body plan' },
  { key: 'has-arms', label: 'Has arms', kind: 'objective', description: 'Has distinct arms' },
  { key: 'round-body', label: 'Round body', kind: 'objective', description: 'Ball or blob shaped' },
  { key: 'insectoid', label: 'Insectoid', kind: 'objective', description: 'Insect-like body' },
  { key: 'has-tentacles', label: 'Has tentacles', kind: 'objective', description: 'Tentacled body' },
  // Color (derived from pokeapi species color)
  { key: 'mostly-red', label: 'Mostly red', kind: 'objective', description: 'Primary color red' },
  { key: 'mostly-blue', label: 'Mostly blue', kind: 'objective', description: 'Primary color blue' },
  { key: 'mostly-yellow', label: 'Mostly yellow', kind: 'objective', description: 'Primary color yellow' },
  { key: 'mostly-green', label: 'Mostly green', kind: 'objective', description: 'Primary color green' },
  { key: 'mostly-pink', label: 'Mostly pink', kind: 'objective', description: 'Primary color pink' },
  { key: 'mostly-purple', label: 'Mostly purple', kind: 'objective', description: 'Primary color purple' },
  { key: 'mostly-brown', label: 'Mostly brown', kind: 'objective', description: 'Primary color brown' },
  { key: 'mostly-black', label: 'Mostly black', kind: 'objective', description: 'Primary color black' },
  { key: 'mostly-white', label: 'Mostly white', kind: 'objective', description: 'Primary color white' },
  { key: 'mostly-gray', label: 'Mostly gray', kind: 'objective', description: 'Primary color gray' },
  // Resemblance (partially derived, partially curated)
  { key: 'dragon-like', label: 'Dragon-like', kind: 'subjective', description: 'Resembles a dragon' },
  { key: 'bird-like', label: 'Bird-like', kind: 'subjective', description: 'Resembles a bird' },
  { key: 'feline', label: 'Feline', kind: 'subjective', description: 'Resembles a cat' },
  { key: 'canine', label: 'Canine', kind: 'subjective', description: 'Resembles a dog or wolf' },
  { key: 'rodent-like', label: 'Rodent-like', kind: 'subjective', description: 'Resembles a rodent' },
  { key: 'mechanical', label: 'Mechanical', kind: 'subjective', description: 'Machine-like appearance' },
  { key: 'object-like', label: 'Object-like', kind: 'subjective', description: 'Based on an inanimate object' },
  { key: 'plant-like', label: 'Plant-like', kind: 'subjective', description: 'Resembles a plant' },
  // Impression (curated only)
  { key: 'cute', label: 'Cute', kind: 'subjective', description: 'Generally considered cute' },
  { key: 'intimidating', label: 'Intimidating', kind: 'subjective', description: 'Scary or menacing look' },
] as const;

export const TRAIT_KINDS: Readonly<Record<string, TraitKind>> = Object.fromEntries(
  TRAIT_DEFINITIONS.map((t) => [t.key, t.kind]),
);

export function isKnownTrait(key: string): boolean {
  return key in TRAIT_KINDS;
}
