/**
 * Pure normalization: raw PokéAPI payloads -> application records.
 * No I/O here so the logic is unit-testable.
 */

import type { PokemonRecord } from '../../shared/types';
import type { RawChainLink, RawEvolutionChain, RawPokemon, RawSpecies } from './pokeapi-types';

const GENERATION_BY_SLUG: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

export function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match || match[1] === undefined) {
    throw new Error(`Cannot extract id from url: ${url}`);
  }
  return Number(match[1]);
}

export interface EvolutionLineInfo {
  lineId: number;
  maxStage: number;
  isBranching: boolean;
  speciesCount: number;
  /** species id -> 1-based stage within the line */
  stageBySpecies: Map<number, number>;
  /** species id -> true when it has at least one further evolution */
  canEvolveBySpecies: Map<number, boolean>;
  edges: EvolutionEdge[];
}

export interface EvolutionEdge {
  lineId: number;
  fromSpeciesId: number;
  toSpeciesId: number;
  trigger: string | null;
  detailJson: string | null;
}

export function normalizeEvolutionChain(chain: RawEvolutionChain): EvolutionLineInfo {
  const stageBySpecies = new Map<number, number>();
  const canEvolveBySpecies = new Map<number, boolean>();
  const edges: EvolutionEdge[] = [];
  let maxStage = 1;
  let isBranching = false;

  const walk = (link: RawChainLink, stage: number): void => {
    const speciesId = idFromUrl(link.species.url);
    stageBySpecies.set(speciesId, stage);
    canEvolveBySpecies.set(speciesId, link.evolves_to.length > 0);
    maxStage = Math.max(maxStage, stage);
    if (link.evolves_to.length > 1) isBranching = true;
    for (const child of link.evolves_to) {
      const childId = idFromUrl(child.species.url);
      const detail = child.evolution_details[0];
      edges.push({
        lineId: chain.id,
        fromSpeciesId: speciesId,
        toSpeciesId: childId,
        trigger: detail?.trigger?.name ?? null,
        detailJson: child.evolution_details.length > 0 ? JSON.stringify(child.evolution_details) : null,
      });
      walk(child, stage + 1);
    }
  };
  walk(chain.chain, 1);

  return {
    lineId: chain.id,
    maxStage,
    isBranching,
    speciesCount: stageBySpecies.size,
    stageBySpecies,
    canEvolveBySpecies,
    edges,
  };
}

export interface NormalizeInput {
  pokemon: RawPokemon;
  species: RawSpecies;
  line: EvolutionLineInfo | null;
  starterLineIds: ReadonlySet<number>;
  importedAt: string;
}

export function normalizePokemon(input: NormalizeInput): PokemonRecord {
  const { pokemon, species, line, starterLineIds, importedAt } = input;

  const generation = GENERATION_BY_SLUG[species.generation.name];
  if (generation === undefined) {
    throw new Error(`Unknown generation slug "${species.generation.name}" for ${species.name}`);
  }

  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
  const primaryType = types[0];
  if (primaryType === undefined) {
    throw new Error(`Pokemon ${pokemon.name} has no types`);
  }

  const englishName = species.names.find((n) => n.language.name === 'en')?.name ?? titleCase(species.name);

  const stage = line?.stageBySpecies.get(species.id) ?? 1;
  const canEvolve = line?.canEvolveBySpecies.get(species.id) ?? false;

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: englishName,
    generation,
    speciesId: species.id,
    defaultFormName: null, // species-level records; forms arrive in a later version
    primaryType,
    secondaryType: types[1] ?? null,
    types,
    heightDecimeters: pokemon.height,
    weightHectograms: pokemon.weight,
    baseExperience: pokemon.base_experience,
    baseStatTotal: pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0),
    abilities: [...new Set(pokemon.abilities.map((a) => a.ability.name))],
    eggGroups: species.egg_groups.map((g) => g.name),
    color: species.color?.name ?? null,
    shape: species.shape?.name ?? null,
    habitat: species.habitat?.name ?? null,
    growthRate: species.growth_rate?.name ?? null,
    genderRate: species.gender_rate,
    isBaby: species.is_baby,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    isStarter: line !== null && starterLineIds.has(line.lineId),
    hasPreEvolution: stage > 1,
    canEvolve,
    evolutionStage: stage,
    maximumEvolutionStage: line?.maxStage ?? 1,
    evolutionLineId: line?.lineId ?? null,
    hasBranchingEvolution: line?.isBranching ?? false,
    spriteUrl: pokemon.sprites.front_default,
    officialArtworkUrl: pokemon.sprites.other?.['official-artwork']?.front_default ?? null,
    importedAt,
  };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
