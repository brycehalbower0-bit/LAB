/**
 * Turn normalized JSON (data/normalized/) + curated data into idempotent SQL
 * batches in data/generated-sql/, ready for `wrangler d1 execute`.
 *
 *   tsx scripts/sync/build-sql.ts             # from data/normalized
 *   tsx scripts/sync/build-sql.ts --fixture   # from data/fixtures (tests/dev)
 *
 * All statements are INSERT OR REPLACE (upserts), so re-running a sync
 * updates existing records in place.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { PokemonRecord } from '../../shared/types';
import { TRAIT_DEFINITIONS } from '../../shared/traits';
import { buildQuestionBank } from '../../shared/engine/question-bank';
import { deriveTraits, mergeAssignments, type TraitAssignment } from './derive-traits';

const ROOT = path.join(import.meta.dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data', 'generated-sql');

interface NormalizedFile {
  meta: { source: string; importedAt: string; rangeStart: number; rangeEnd: number; count: number };
  records: PokemonRecord[];
}

interface EvolutionFile {
  lines: { id: number; rootSpeciesId: number; maxStage: number; isBranching: boolean; speciesCount: number }[];
  edges: { lineId: number; fromSpeciesId: number; toSpeciesId: number; trigger: string | null; detailJson: string | null }[];
}

const sq = (value: string): string => `'${value.replaceAll("'", "''")}'`;

function lit(value: string | number | boolean | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number in SQL: ${value}`);
    return String(value);
  }
  return sq(value);
}

function insertBatch(table: string, columns: string[], rows: (string | number | boolean | null)[][]): string {
  if (rows.length === 0) return '';
  const chunks: string[] = [];
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows
      .slice(i, i + CHUNK)
      .map((row) => `(${row.map(lit).join(',')})`)
      .join(',\n');
    chunks.push(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES\n${values};`);
  }
  return chunks.join('\n');
}

async function main(): Promise<void> {
  const fixture = process.argv.includes('--fixture');
  const inDir = fixture ? path.join(ROOT, 'data', 'fixtures') : path.join(ROOT, 'data', 'normalized');

  const pokemonFile = JSON.parse(await readFile(path.join(inDir, 'pokemon.json'), 'utf8')) as NormalizedFile;
  const evolutionFile = JSON.parse(await readFile(path.join(inDir, 'evolution.json'), 'utf8')) as EvolutionFile;
  const curatedFile = JSON.parse(
    await readFile(path.join(ROOT, 'data', 'curated', 'trait-assignments.json'), 'utf8'),
  ) as { assignments: { pokemonId: number; traitKey: string; confidence: number }[] };

  const { records } = pokemonFile;
  const recordIds = new Set(records.map((r) => r.id));
  await mkdir(OUT_DIR, { recursive: true });

  // 1. Evolution lines (referenced by pokemon.evolution_line_id).
  const referencedLineIds = new Set(records.map((r) => r.evolutionLineId).filter((id) => id !== null));
  const linesSql = insertBatch(
    'evolution_lines',
    ['id', 'root_species_id', 'max_stage', 'is_branching', 'species_count', 'imported_at'],
    evolutionFile.lines
      .filter((line) => referencedLineIds.has(line.id))
      .map((line) => [line.id, line.rootSpeciesId, line.maxStage, line.isBranching, line.speciesCount, pokemonFile.meta.importedAt]),
  );

  // 2. Pokémon.
  const pokemonSql = insertBatch(
    'pokemon',
    [
      'id', 'name', 'display_name', 'generation', 'species_id', 'default_form_name',
      'primary_type', 'secondary_type', 'types_json', 'height_decimeters', 'weight_hectograms',
      'base_experience', 'base_stat_total', 'abilities_json', 'egg_groups_json', 'color',
      'shape', 'habitat', 'growth_rate', 'gender_rate', 'is_baby', 'is_legendary',
      'is_mythical', 'is_starter', 'has_pre_evolution', 'can_evolve', 'evolution_stage',
      'maximum_evolution_stage', 'evolution_line_id', 'has_branching_evolution',
      'sprite_url', 'official_artwork_url', 'imported_at',
    ],
    records.map((r) => [
      r.id, r.name, r.displayName, r.generation, r.speciesId, r.defaultFormName,
      r.primaryType, r.secondaryType, JSON.stringify(r.types), r.heightDecimeters, r.weightHectograms,
      r.baseExperience, r.baseStatTotal, JSON.stringify(r.abilities), JSON.stringify(r.eggGroups), r.color,
      r.shape, r.habitat, r.growthRate, r.genderRate, r.isBaby, r.isLegendary,
      r.isMythical, r.isStarter, r.hasPreEvolution, r.canEvolve, r.evolutionStage,
      r.maximumEvolutionStage, r.evolutionLineId, r.hasBranchingEvolution,
      r.spriteUrl, r.officialArtworkUrl, r.importedAt,
    ]),
  );

  // 3. Type rows (INSERT OR REPLACE on pokemon cascades old type rows away
  //    only on delete; refresh explicitly for updated records).
  const typesSql =
    `DELETE FROM pokemon_types WHERE pokemon_id IN (SELECT id FROM pokemon);\n` +
    insertBatch(
      'pokemon_types',
      ['pokemon_id', 'type', 'slot'],
      records.flatMap((r) => r.types.map((type, index) => [r.id, type, index + 1] as (string | number)[])),
    );

  // 4. Evolution edges (only those between imported species).
  const edgesSql = insertBatch(
    'evolution_edges',
    ['line_id', 'from_species_id', 'to_species_id', 'trigger', 'detail_json'],
    evolutionFile.edges
      .filter((e) => referencedLineIds.has(e.lineId))
      .map((e) => [e.lineId, e.fromSpeciesId, e.toSpeciesId, e.trigger, e.detailJson]),
  );

  // 5. Traits: definitions + derived/curated assignments.
  const traitRows = TRAIT_DEFINITIONS.map((t, index) => [index + 1, t.key, t.label, t.kind, t.description]);
  const traitIdByKey = new Map(TRAIT_DEFINITIONS.map((t, index) => [t.key, index + 1]));
  const derived = records.flatMap((r) => deriveTraits(r));
  const curated: TraitAssignment[] = curatedFile.assignments
    .filter((a) => recordIds.has(a.pokemonId))
    .map((a) => ({ pokemonId: a.pokemonId, traitKey: a.traitKey, confidence: a.confidence, source: 'curated' }));
  const merged = mergeAssignments(derived, curated);
  const unknownTraits = merged.filter((m) => !traitIdByKey.has(m.traitKey));
  if (unknownTraits.length > 0) {
    throw new Error(`Unknown trait keys: ${[...new Set(unknownTraits.map((t) => t.traitKey))].join(', ')}`);
  }
  const traitsSql =
    insertBatch('traits', ['id', 'key', 'label', 'kind', 'description'], traitRows) +
    '\n' +
    insertBatch(
      'pokemon_traits',
      ['pokemon_id', 'trait_id', 'confidence', 'source', 'evidence_count'],
      merged.map((m) => [m.pokemonId, traitIdByKey.get(m.traitKey) ?? 0, m.confidence, m.source, m.evidenceCount]),
    );

  // 6. Question bank.
  const questions = buildQuestionBank();
  const questionsSql = insertBatch(
    'questions',
    ['id', 'key', 'text', 'category', 'property', 'operator', 'comparison_value', 'reliability', 'priority', 'source'],
    questions.map((q, index) => [
      index + 1,
      q.key,
      q.text,
      q.category,
      q.query.kind,
      'op' in q.query ? q.query.op : 'eq',
      JSON.stringify(q.query),
      q.reliability,
      q.priority,
      'generated',
    ]),
  );

  const files: [string, string][] = [
    ['01_evolution_lines.sql', linesSql],
    ['02_pokemon.sql', pokemonSql],
    ['03_pokemon_types.sql', typesSql],
    ['04_evolution_edges.sql', edgesSql],
    ['05_traits.sql', traitsSql],
    ['06_questions.sql', questionsSql],
  ];
  for (const [name, sql] of files) {
    await writeFile(path.join(OUT_DIR, name), sql + '\n');
  }
  await writeFile(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify({ ...pokemonFile.meta, fixture, questionCount: questions.length, traitAssignments: merged.length }, null, 2),
  );

  console.log(
    `SQL written to data/generated-sql: ${records.length} pokemon, ${merged.length} trait assignments, ${questions.length} questions${fixture ? ' (fixture)' : ''}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
