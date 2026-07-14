/**
 * Deterministic query evaluation.
 *
 * `matchProbability` estimates P(truthful player answers "yes") for a query
 * against a specific Pokémon. Hard facts return 0.02/0.98-style extremes via
 * the engine's likelihood model rather than here — here 0 and 1 mean "the
 * data says definitively no/yes". Trait-backed queries return the stored
 * confidence. Missing data returns 0.5 (unknown).
 */

import type { CandidatePokemon } from '../types';
import type { EngineAnswer } from '../types';
import type { StructuredQuery, ParsedQuestion } from '../query';
import { compare } from '../query';

export type TraitKind = 'objective' | 'subjective';

export interface EvaluationContext {
  /** Trait key -> objective/subjective. Unknown keys are treated as subjective. */
  traitKinds: Readonly<Record<string, TraitKind>>;
  /** Resolve another Pokémon's evolution line (for "is it in Pikachu's line?"). */
  evolutionLineOf?: (pokemonId: number) => number | null;
}

const b = (value: boolean): number => (value ? 1 : 0);

/**
 * Probability that the honest answer to `query` for `candidate` is "yes".
 * Returns a value in [0, 1]; 0.5 means the data cannot answer.
 */
export function matchProbability(
  query: StructuredQuery,
  candidate: CandidatePokemon,
  ctx: EvaluationContext,
): number {
  const p = candidate.record;
  switch (query.kind) {
    case 'type':
      return b(p.types.includes(query.type));
    case 'dual-type':
      return b(p.secondaryType !== null);
    case 'generation':
      return b(compare(query.op, p.generation, query.generation));
    case 'legendary':
      return b(p.isLegendary);
    case 'mythical':
      return b(p.isMythical);
    case 'legendary-or-mythical':
      return b(p.isLegendary || p.isMythical);
    case 'baby':
      return b(p.isBaby);
    case 'starter':
      return b(p.isStarter);
    case 'can-evolve':
      return b(p.canEvolve);
    case 'fully-evolved':
      return b(!p.canEvolve);
    case 'has-pre-evolution':
      return b(p.hasPreEvolution);
    case 'middle-evolution':
      return b(p.canEvolve && p.hasPreEvolution);
    case 'branching-evolution':
      return b(p.hasBranchingEvolution);
    case 'evolution-stage':
      return b(p.evolutionStage === query.stage);
    case 'in-evolution-line-of': {
      const line = ctx.evolutionLineOf?.(query.pokemonId) ?? null;
      if (line === null || p.evolutionLineId === null) return 0.5;
      return b(p.evolutionLineId === line);
    }
    case 'height':
      return b(compare(query.op, p.heightDecimeters, query.decimeters));
    case 'weight':
      return b(compare(query.op, p.weightHectograms, query.hectograms));
    case 'stat-total':
      return b(compare(query.op, p.baseStatTotal, query.value));
    case 'color':
      return p.color === null ? 0.5 : b(p.color === query.color);
    case 'habitat':
      return p.habitat === null ? 0.5 : b(p.habitat === query.habitat);
    case 'trait': {
      const confidence = candidate.traits[query.trait];
      if (confidence !== undefined) return confidence;
      // No trait row: objective trait catalogs are complete, so absence is a
      // firm "no"; subjective traits are simply uncurated for this Pokémon.
      const kind = ctx.traitKinds[query.trait] ?? 'subjective';
      return kind === 'objective' ? 0.02 : 0.5;
    }
    case 'egg-group':
      return b(p.eggGroups.includes(query.eggGroup));
    case 'ability':
      return b(p.abilities.includes(query.ability));
    case 'genderless':
      return p.genderRate === null ? 0.5 : b(p.genderRate === -1);
    case 'single-gender': {
      if (p.genderRate === null) return 0.5;
      if (p.genderRate === -1) return 0;
      return b(query.gender === 'female' ? p.genderRate === 8 : p.genderRate === 0);
    }
    case 'name-guess':
      return b(p.id === query.pokemonId || p.speciesId === query.pokemonId);
    case 'name-letter': {
      const name = p.name;
      switch (query.position) {
        case 'starts':
          return b(name.startsWith(query.letter));
        case 'ends':
          return b(name.endsWith(query.letter));
        case 'contains':
          return b(name.includes(query.letter));
      }
    }
  }
}

/**
 * Answer a parsed player question (player-guesses mode). Special cases:
 * mixed-gender species answer "sometimes" to single-gender questions.
 */
export function answerQuestion(
  question: ParsedQuestion,
  candidate: CandidatePokemon,
  ctx: EvaluationContext,
): EngineAnswer {
  const { query, negated } = question;
  const p = candidate.record;

  if (
    query.kind === 'single-gender' &&
    p.genderRate !== null &&
    p.genderRate > 0 &&
    p.genderRate < 8
  ) {
    return 'sometimes';
  }

  const probability = matchProbability(query, candidate, ctx);
  const effective = negated ? 1 - probability : probability;

  if (effective >= 0.9) return 'yes';
  if (effective > 0.55) return 'probably';
  if (effective >= 0.45) return 'unknown';
  if (effective > 0.1) return 'probably-not';
  return 'no';
}
