/**
 * D1 data access. All queries use prepared statements with bound parameters.
 * The Pokémon dataset and question bank are immutable between imports, so
 * they are cached per-isolate with a TTL.
 */

import type { CandidatePokemon, PokemonRecord } from '../shared/types';
import type { EngineQuestion } from '../shared/engine/guesser';
import { structuredQuerySchema } from '../shared/query';
import type { PokemonPublic } from '../shared/api';
import { normalizePokemonName } from '../shared/parser/parse';

interface PokemonRow {
  id: number;
  name: string;
  display_name: string;
  generation: number;
  species_id: number;
  default_form_name: string | null;
  primary_type: string;
  secondary_type: string | null;
  types_json: string;
  height_decimeters: number;
  weight_hectograms: number;
  base_experience: number | null;
  base_stat_total: number;
  abilities_json: string;
  egg_groups_json: string;
  color: string | null;
  shape: string | null;
  habitat: string | null;
  growth_rate: string | null;
  gender_rate: number | null;
  is_baby: number;
  is_legendary: number;
  is_mythical: number;
  is_starter: number;
  has_pre_evolution: number;
  can_evolve: number;
  evolution_stage: number;
  maximum_evolution_stage: number;
  evolution_line_id: number | null;
  has_branching_evolution: number;
  sprite_url: string | null;
  official_artwork_url: string | null;
  imported_at: string;
}

function rowToRecord(row: PokemonRow): PokemonRecord {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    generation: row.generation,
    speciesId: row.species_id,
    defaultFormName: row.default_form_name,
    primaryType: row.primary_type,
    secondaryType: row.secondary_type,
    types: JSON.parse(row.types_json) as string[],
    heightDecimeters: row.height_decimeters,
    weightHectograms: row.weight_hectograms,
    baseExperience: row.base_experience,
    baseStatTotal: row.base_stat_total,
    abilities: JSON.parse(row.abilities_json) as string[],
    eggGroups: JSON.parse(row.egg_groups_json) as string[],
    color: row.color,
    shape: row.shape,
    habitat: row.habitat,
    growthRate: row.growth_rate,
    genderRate: row.gender_rate,
    isBaby: row.is_baby === 1,
    isLegendary: row.is_legendary === 1,
    isMythical: row.is_mythical === 1,
    isStarter: row.is_starter === 1,
    hasPreEvolution: row.has_pre_evolution === 1,
    canEvolve: row.can_evolve === 1,
    evolutionStage: row.evolution_stage,
    maximumEvolutionStage: row.maximum_evolution_stage,
    evolutionLineId: row.evolution_line_id,
    hasBranchingEvolution: row.has_branching_evolution === 1,
    spriteUrl: row.sprite_url,
    officialArtworkUrl: row.official_artwork_url,
    importedAt: row.imported_at,
  };
}

export function toPublic(record: PokemonRecord): PokemonPublic {
  return {
    id: record.id,
    name: record.name,
    displayName: record.displayName,
    generation: record.generation,
    types: record.types,
    spriteUrl: record.spriteUrl,
    officialArtworkUrl: record.officialArtworkUrl,
  };
}

export interface Dataset {
  candidates: CandidatePokemon[];
  byId: Map<number, CandidatePokemon>;
  /** normalized name/display-name -> pokemon id (parser lookups). */
  nameToId: Map<string, number>;
  questions: EngineQuestion[];
  questionsById: Map<number, EngineQuestion>;
  importedAt: string | null;
}

interface DatasetCache {
  dataset: Dataset;
  loadedAt: number;
}

let datasetCache: DatasetCache | null = null;
const DATASET_TTL_MS = 5 * 60 * 1000;

export async function loadDataset(db: D1Database): Promise<Dataset> {
  if (datasetCache !== null && Date.now() - datasetCache.loadedAt < DATASET_TTL_MS) {
    return datasetCache.dataset;
  }

  const results = await db.batch([
    db.prepare('SELECT * FROM pokemon ORDER BY id'),
    db.prepare(
      `SELECT pt.pokemon_id AS pokemon_id, t.key AS key, pt.confidence AS confidence
       FROM pokemon_traits pt JOIN traits t ON t.id = pt.trait_id
       WHERE pt.review_status != 'rejected'`,
    ),
    db.prepare('SELECT * FROM questions WHERE enabled = 1 ORDER BY id'),
  ]);
  const [pokemonResult, traitResult, questionResult] = results;
  if (pokemonResult === undefined || traitResult === undefined || questionResult === undefined) {
    throw new Error('dataset batch query returned fewer results than expected');
  }

  const traitRows = traitResult.results as { pokemon_id: number; key: string; confidence: number }[];
  const traitsByPokemon = new Map<number, Record<string, number>>();
  for (const row of traitRows) {
    let map = traitsByPokemon.get(row.pokemon_id);
    if (map === undefined) {
      map = {};
      traitsByPokemon.set(row.pokemon_id, map);
    }
    map[row.key] = row.confidence;
  }

  const candidates = (pokemonResult.results as unknown as PokemonRow[]).map((row) => ({
    record: rowToRecord(row),
    traits: traitsByPokemon.get(row.id) ?? {},
  }));

  const questionRows = questionResult.results as {
    id: number;
    key: string;
    text: string;
    category: string;
    comparison_value: string;
    reliability: number;
    priority: number;
  }[];
  const questions: EngineQuestion[] = [];
  for (const row of questionRows) {
    const parsed = structuredQuerySchema.safeParse(JSON.parse(row.comparison_value));
    if (!parsed.success) {
      // A malformed question row must never break games; skip it.
      console.error(`question ${row.key} has invalid comparison_value; skipping`);
      continue;
    }
    questions.push({
      id: row.id,
      key: row.key,
      text: row.text,
      category: row.category,
      query: parsed.data,
      reliability: row.reliability,
      priority: row.priority,
    });
  }

  const nameToId = new Map<string, number>();
  for (const candidate of candidates) {
    nameToId.set(normalizePokemonName(candidate.record.name), candidate.record.id);
    nameToId.set(normalizePokemonName(candidate.record.displayName), candidate.record.id);
  }

  const dataset: Dataset = {
    candidates,
    byId: new Map(candidates.map((c) => [c.record.id, c])),
    nameToId,
    questions,
    questionsById: new Map(questions.map((q) => [q.id, q])),
    importedAt: candidates[0]?.record.importedAt ?? null,
  };
  datasetCache = { dataset, loadedAt: Date.now() };
  return dataset;
}

/** Test hook / cache reset (e.g. after imports). */
export function resetDatasetCache(): void {
  datasetCache = null;
}
