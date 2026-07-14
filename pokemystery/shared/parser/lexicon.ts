/**
 * Vocabulary for the deterministic parser: aliases, units, and phrase → trait
 * mappings. Everything is lowercase; input is normalized before lookup.
 */

import type { TypeName } from '../types';

export const TYPE_ALIASES: Readonly<Record<string, TypeName>> = {
  normal: 'normal',
  fire: 'fire',
  flame: 'fire',
  water: 'water',
  electric: 'electric',
  electricity: 'electric',
  lightning: 'electric',
  grass: 'grass',
  ice: 'ice',
  fighting: 'fighting',
  poison: 'poison',
  ground: 'ground',
  flying: 'flying',
  psychic: 'psychic',
  bug: 'bug',
  rock: 'rock',
  ghost: 'ghost',
  dragon: 'dragon',
  dark: 'dark',
  steel: 'steel',
  fairy: 'fairy',
};

/** Region and generation-word aliases → generation number. */
export const GENERATION_ALIASES: Readonly<Record<string, number>> = {
  kanto: 1,
  johto: 2,
  hoenn: 3,
  sinnoh: 4,
  unova: 5,
  kalos: 6,
  alola: 7,
  galar: 8,
  hisui: 8,
  paldea: 9,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
};

export const COLOR_WORDS = [
  'red', 'blue', 'yellow', 'green', 'pink', 'purple', 'brown', 'black', 'white', 'gray', 'grey',
] as const;

/** Phrases resolving directly to trait queries. Checked in order. */
export const TRAIT_PHRASES: readonly [pattern: RegExp, trait: string][] = [
  [/\b(?:four|4)[\s-]?leg(?:s|ged)?\b/, 'four-legged'],
  [/\bwalk(?:s)? on (?:four|4|all fours)\b/, 'four-legged'],
  [/\bquadruped\b/, 'four-legged'],
  [/\b(?:two|2)[\s-]?leg(?:s|ged)?\b/, 'bipedal'],
  [/\bbipedal\b/, 'bipedal'],
  [/\bstand(?:s)? (?:up|upright|on two)\b/, 'bipedal'],
  [/\bwing(?:s|ed)?\b/, 'has-wings'],
  [/\bsnake|serpent(?:ine)?\b/, 'serpentine'],
  [/\bfish\b/, 'fish-like'],
  [/\bhumanoid|human[\s-]?like|look(?:s)? like a (?:human|person)\b/, 'humanoid'],
  [/\bround|ball[\s-]?shaped|spher(?:e|ical)\b/, 'round-body'],
  [/\binsect|bug[\s-]?like\b/, 'insectoid'],
  [/\btentacle(?:s|d)?\b/, 'has-tentacles'],
  [/\bbird\b/, 'bird-like'],
  [/\b(?:cat|feline|kitten)\b/, 'feline'],
  [/\b(?:dog|puppy|wolf|canine|fox)\b/, 'canine'],
  [/\b(?:mouse|rat|rodent|squirrel)\b/, 'rodent-like'],
  [/\b(?:robot|machine|mechanical|man[\s-]?made)\b/, 'mechanical'],
  [/\b(?:object|inanimate|item)\b/, 'object-like'],
  [/\b(?:plant|flower|tree|mushroom)\b/, 'plant-like'],
  [/\bcute|adorable\b/, 'cute'],
  [/\b(?:intimidating|scary|menacing|frightening|creepy)\b/, 'intimidating'],
];

/** Habitat words → pokeapi habitat slugs (only defined for gens 1–3 data). */
export const HABITAT_ALIASES: Readonly<Record<string, string>> = {
  ocean: 'sea',
  sea: 'sea',
  water: 'waters-edge',
  cave: 'cave',
  caves: 'cave',
  forest: 'forest',
  forests: 'forest',
  woods: 'forest',
  mountain: 'mountain',
  mountains: 'mountain',
  grassland: 'grassland',
  grasslands: 'grassland',
  field: 'grassland',
  fields: 'grassland',
  city: 'urban',
  cities: 'urban',
  urban: 'urban',
};

/** Contractions expanded during normalization. */
export const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bisn'?t\b/g, 'is not'],
  [/\bdoesn'?t\b/g, 'does not'],
  [/\bdon'?t\b/g, 'do not'],
  [/\bcan'?t\b/g, 'can not'],
  [/\bwasn'?t\b/g, 'was not'],
  [/\bwon'?t\b/g, 'will not'],
  [/\bit'?s\b/g, 'it is'],
  [/\bwhat'?s\b/g, 'what is'],
];

/** Number words accepted in measurements. */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  'a half': 0.5,
};
