/**
 * The structured query model.
 *
 * Every question — whether generated for the AI-guesser question bank, parsed
 * deterministically from player text, or produced by the optional AI fallback
 * parser — is normalized into a `StructuredQuery`. The deterministic evaluator
 * (shared/engine/evaluate.ts) is the single authority for answering them;
 * a language model never answers Pokémon facts directly.
 */

import { z } from 'zod';
import { TYPE_NAMES } from './types';

const comparisonOp = z.enum(['eq', 'gt', 'gte', 'lt', 'lte']);
export type ComparisonOp = z.infer<typeof comparisonOp>;

export const structuredQuerySchema = z.discriminatedUnion('kind', [
  // Typing
  z.object({ kind: z.literal('type'), type: z.enum(TYPE_NAMES) }),
  z.object({ kind: z.literal('dual-type') }),
  // Origin
  z.object({
    kind: z.literal('generation'),
    op: comparisonOp,
    generation: z.number().int().min(1).max(9),
  }),
  // Category flags
  z.object({ kind: z.literal('legendary') }),
  z.object({ kind: z.literal('mythical') }),
  z.object({ kind: z.literal('legendary-or-mythical') }),
  z.object({ kind: z.literal('baby') }),
  z.object({ kind: z.literal('starter') }),
  // Evolution
  z.object({ kind: z.literal('can-evolve') }),
  z.object({ kind: z.literal('fully-evolved') }),
  z.object({ kind: z.literal('has-pre-evolution') }),
  z.object({ kind: z.literal('middle-evolution') }),
  z.object({ kind: z.literal('branching-evolution') }),
  z.object({ kind: z.literal('evolution-stage'), stage: z.number().int().min(1).max(3) }),
  z.object({ kind: z.literal('in-evolution-line-of'), pokemonId: z.number().int().positive() }),
  // Dimensions
  z.object({
    kind: z.literal('height'),
    op: comparisonOp,
    decimeters: z.number().positive(),
  }),
  z.object({
    kind: z.literal('weight'),
    op: comparisonOp,
    hectograms: z.number().positive(),
  }),
  z.object({
    kind: z.literal('stat-total'),
    op: comparisonOp,
    value: z.number().int().positive(),
  }),
  // Appearance / species metadata
  z.object({ kind: z.literal('color'), color: z.string().min(1) }),
  z.object({ kind: z.literal('habitat'), habitat: z.string().min(1) }),
  z.object({ kind: z.literal('trait'), trait: z.string().min(1) }),
  z.object({ kind: z.literal('egg-group'), eggGroup: z.string().min(1) }),
  z.object({ kind: z.literal('ability'), ability: z.string().min(1) }),
  z.object({ kind: z.literal('genderless') }),
  z.object({ kind: z.literal('single-gender'), gender: z.enum(['male', 'female']) }),
  // Name
  z.object({ kind: z.literal('name-guess'), pokemonId: z.number().int().positive() }),
  z.object({
    kind: z.literal('name-letter'),
    letter: z.string().regex(/^[a-z]$/),
    position: z.enum(['starts', 'contains', 'ends']),
  }),
]);

export type StructuredQuery = z.infer<typeof structuredQuerySchema>;
export type QueryKind = StructuredQuery['kind'];

/** A parsed player question: the query plus whether it was negated. */
export const parsedQuestionSchema = z.object({
  query: structuredQuerySchema,
  negated: z.boolean(),
});
export type ParsedQuestion = z.infer<typeof parsedQuestionSchema>;

export function compare(op: ComparisonOp, left: number, right: number): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
  }
}
