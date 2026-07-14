/**
 * The static question bank for the AI-guesser (Mode 1).
 *
 * Every question is a StructuredQuery plus player-facing text and a
 * reliability estimate (how often a typical player answers it correctly).
 * The bank is inserted into D1 by the data pipeline; the engine evaluates
 * queries against candidates at runtime, so no per-Pokémon matrix is needed.
 */

import type { StructuredQuery } from '../query';
import { TYPE_NAMES } from '../types';

export interface QuestionDefinition {
  key: string;
  text: string;
  category: string;
  query: StructuredQuery;
  reliability: number;
  priority: number;
}

const REGION_BY_GENERATION: Record<number, string> = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildQuestionBank(): QuestionDefinition[] {
  const questions: QuestionDefinition[] = [];
  const add = (
    key: string,
    text: string,
    category: string,
    query: StructuredQuery,
    reliability: number,
    priority = 0,
  ): void => {
    questions.push({ key, text, category, query, reliability, priority });
  };

  for (const type of TYPE_NAMES) {
    add(`type-${type}`, `Is it a ${capitalize(type)} type?`, 'type', { kind: 'type', type }, 0.96);
  }
  add('dual-type', 'Does it have two types?', 'type', { kind: 'dual-type' }, 0.85);

  for (let generation = 1; generation <= 9; generation += 1) {
    add(
      `gen-eq-${generation}`,
      `Was it first introduced in Generation ${generation} (${REGION_BY_GENERATION[generation] ?? ''})?`,
      'generation',
      { kind: 'generation', op: 'eq', generation },
      0.88,
    );
  }
  for (const generation of [2, 4, 6] as const) {
    add(
      `gen-lte-${generation}`,
      `Was it first introduced in Generation ${generation} or earlier?`,
      'generation',
      { kind: 'generation', op: 'lte', generation },
      0.82,
    );
  }

  add('legendary-or-mythical', 'Is it a Legendary or Mythical Pokémon?', 'category', { kind: 'legendary-or-mythical' }, 0.93);
  add('legendary', 'Is it a Legendary Pokémon?', 'category', { kind: 'legendary' }, 0.88);
  add('mythical', 'Is it a Mythical Pokémon?', 'category', { kind: 'mythical' }, 0.8);
  add('baby', 'Is it a baby Pokémon?', 'category', { kind: 'baby' }, 0.82);
  add('starter', 'Is it a starter Pokémon or one of its evolutions?', 'category', { kind: 'starter' }, 0.9);

  add('can-evolve', 'Can it still evolve?', 'evolution', { kind: 'can-evolve' }, 0.88);
  add('has-pre-evolution', 'Did it evolve from another Pokémon?', 'evolution', { kind: 'has-pre-evolution' }, 0.85);
  add('stage-1', 'Is it the first stage of its evolution line?', 'evolution', { kind: 'evolution-stage', stage: 1 }, 0.82);
  add('branching-evolution', 'Does its evolution line branch into different Pokémon?', 'evolution', { kind: 'branching-evolution' }, 0.65, -0.02);

  add('height-gt-10', 'Is it taller than 1 meter?', 'size', { kind: 'height', op: 'gt', decimeters: 10 }, 0.8);
  add('height-gt-20', 'Is it taller than 2 meters?', 'size', { kind: 'height', op: 'gt', decimeters: 20 }, 0.8);
  add('height-lte-5', 'Is it 50 cm tall or shorter?', 'size', { kind: 'height', op: 'lte', decimeters: 5 }, 0.75);
  add('weight-gt-500', 'Is it heavier than 50 kg?', 'size', { kind: 'weight', op: 'gt', hectograms: 500 }, 0.72);
  add('weight-lte-100', 'Does it weigh 10 kg or less?', 'size', { kind: 'weight', op: 'lte', hectograms: 100 }, 0.7);

  const colorTraits = [
    'red', 'blue', 'yellow', 'green', 'pink', 'purple', 'brown', 'black', 'white', 'gray',
  ];
  for (const color of colorTraits) {
    add(
      `color-${color}`,
      `Is it mostly ${color}?`,
      'appearance',
      { kind: 'trait', trait: `mostly-${color}` },
      0.78,
    );
  }

  add('four-legged', 'Does it walk on four legs?', 'body', { kind: 'trait', trait: 'four-legged' }, 0.85);
  add('bipedal', 'Does it stand on two legs?', 'body', { kind: 'trait', trait: 'bipedal' }, 0.75);
  add('has-wings', 'Does it have wings?', 'body', { kind: 'trait', trait: 'has-wings' }, 0.85);
  add('serpentine', 'Does it have a long snake-like body?', 'body', { kind: 'trait', trait: 'serpentine' }, 0.8);
  add('fish-like', 'Is it fish-like?', 'body', { kind: 'trait', trait: 'fish-like' }, 0.78);
  add('humanoid', 'Does it look humanoid?', 'body', { kind: 'trait', trait: 'humanoid' }, 0.68, -0.01);
  add('round-body', 'Is its body round like a ball?', 'body', { kind: 'trait', trait: 'round-body' }, 0.7);
  add('insectoid', 'Does it look like an insect?', 'body', { kind: 'trait', trait: 'insectoid' }, 0.8);
  add('genderless', 'Is it genderless?', 'gender', { kind: 'genderless' }, 0.75, -0.01);

  add('dragon-like', 'Does it look like a dragon?', 'impression', { kind: 'trait', trait: 'dragon-like' }, 0.7);
  add('bird-like', 'Does it look like a bird?', 'impression', { kind: 'trait', trait: 'bird-like' }, 0.75);
  add('feline', 'Does it look like a cat?', 'impression', { kind: 'trait', trait: 'feline' }, 0.7);
  add('canine', 'Does it look like a dog or wolf?', 'impression', { kind: 'trait', trait: 'canine' }, 0.7);
  add('mechanical', 'Does it look mechanical or man-made?', 'impression', { kind: 'trait', trait: 'mechanical' }, 0.7);
  add('object-like', 'Is it based on an inanimate object?', 'impression', { kind: 'trait', trait: 'object-like' }, 0.68);
  add('plant-like', 'Does it look like a plant?', 'impression', { kind: 'trait', trait: 'plant-like' }, 0.72);
  add('cute', 'Would most people call it cute?', 'impression', { kind: 'trait', trait: 'cute' }, 0.55, -0.02);
  add('intimidating', 'Does it look intimidating or scary?', 'impression', { kind: 'trait', trait: 'intimidating' }, 0.55, -0.02);

  return questions;
}
