/**
 * Core domain types shared by the Worker, the frontend, and the data
 * pipeline. This module must stay free of React, DOM, Node, and Cloudflare
 * APIs — it is pure TypeScript.
 */

export const TYPE_NAMES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

export type TypeName = (typeof TYPE_NAMES)[number];

export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Generation = (typeof GENERATIONS)[number];

/** Region -> generation introduced. Used by the parser ("is it from Sinnoh?"). */
export const REGION_TO_GENERATION: Readonly<Record<string, Generation>> = {
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
};

/** Canonical normalized Pokémon record (species-level for the initial version). */
export interface PokemonRecord {
  id: number;
  name: string;
  displayName: string;
  generation: number;
  speciesId: number;
  defaultFormName: string | null;
  primaryType: string;
  secondaryType: string | null;
  types: string[];
  heightDecimeters: number;
  weightHectograms: number;
  baseExperience: number | null;
  baseStatTotal: number;
  abilities: string[];
  eggGroups: string[];
  color: string | null;
  shape: string | null;
  habitat: string | null;
  growthRate: string | null;
  genderRate: number | null;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  isStarter: boolean;
  hasPreEvolution: boolean;
  canEvolve: boolean;
  evolutionStage: number;
  maximumEvolutionStage: number;
  evolutionLineId: number | null;
  hasBranchingEvolution: boolean;
  spriteUrl: string | null;
  officialArtworkUrl: string | null;
  importedAt: string;
}

/** Trait confidences for one Pokémon, keyed by trait key (e.g. "four-legged"). */
export type TraitMap = Readonly<Record<string, number>>;

/** Pokémon plus its trait confidences — the unit the game engines consume. */
export interface CandidatePokemon {
  record: PokemonRecord;
  traits: TraitMap;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameSettings {
  /** National-dex generations included (1..9). */
  generations: Generation[];
  includeLegendary: boolean;
  includeMythical: boolean;
  includeBaby: boolean;
  /** Alternate forms. Off by default; species are the unit of play for v1. */
  includeForms: boolean;
  difficulty: Difficulty;
  /** Maximum questions before the game must resolve. */
  maxQuestions: number;
  hintsEnabled: boolean;
  showSpritesOnWin: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  generations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  includeLegendary: true,
  includeMythical: true,
  includeBaby: true,
  includeForms: false,
  difficulty: 'normal',
  maxQuestions: 20,
  hintsEnabled: true,
  showSpritesOnWin: true,
};

/** Direct guesses allowed in player-guesses mode, by difficulty. */
export const DIRECT_GUESS_ALLOWANCE: Readonly<Record<Difficulty, number>> = {
  easy: 5,
  normal: 3,
  hard: 2,
};

/** Player answers in AI-guesses mode. */
export const PLAYER_ANSWERS = ['yes', 'probably-yes', 'unknown', 'probably-no', 'no'] as const;
export type PlayerAnswer = (typeof PLAYER_ANSWERS)[number];

/** Engine answers in player-guesses mode. */
export const ENGINE_ANSWERS = [
  'yes',
  'no',
  'probably',
  'probably-not',
  'sometimes',
  'unknown',
  'rephrase',
] as const;
export type EngineAnswer = (typeof ENGINE_ANSWERS)[number];

/** True if the Pokémon is playable under the given settings. */
export function matchesSettings(pokemon: PokemonRecord, settings: GameSettings): boolean {
  if (!settings.generations.includes(pokemon.generation as Generation)) return false;
  if (!settings.includeLegendary && pokemon.isLegendary) return false;
  if (!settings.includeMythical && pokemon.isMythical) return false;
  if (!settings.includeBaby && pokemon.isBaby) return false;
  if (!settings.includeForms && pokemon.defaultFormName !== null) return false;
  return true;
}
