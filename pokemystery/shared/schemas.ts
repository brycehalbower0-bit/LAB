/**
 * Zod schemas for everything that crosses the HTTP boundary. All API inputs
 * are validated with these; the Worker never trusts client-provided state.
 */

import { z } from 'zod';
import { isGeneration, PLAYER_ANSWERS } from './types';

export const gameSettingsSchema = z.object({
  generations: z
    .array(z.number().int().min(1).max(9))
    .min(1)
    .max(9)
    .transform((gens) => [...new Set(gens)].sort((a, b) => a - b).filter(isGeneration)),
  includeLegendary: z.boolean(),
  includeMythical: z.boolean(),
  includeBaby: z.boolean(),
  includeForms: z.boolean(),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  maxQuestions: z.number().int().min(5).max(40),
  hintsEnabled: z.boolean(),
  showSpritesOnWin: z.boolean(),
});

export const createGameSchema = z.object({
  mode: z.enum(['ai-guesses', 'player-guesses']),
  settings: gameSettingsSchema,
});

export const sessionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{20,64}$/, 'malformed session id');

/** Mode 1: player answers the engine's current question. */
export const answerRequestSchema = z.object({
  answer: z.enum(PLAYER_ANSWERS),
});

/** Mode 1: player responds to the engine's guess. */
export const guessResponseRequestSchema = z.object({
  correct: z.boolean(),
});

/** Mode 1: player reveals their Pokémon at the end. */
export const revealRequestSchema = z.object({
  pokemonId: z.number().int().positive(),
});

/** Mode 2: player asks a natural-language question. */
export const askRequestSchema = z.object({
  text: z.string().trim().min(1).max(200),
});

/** Mode 2: player makes a direct guess by name. */
export const directGuessRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const correctionReportSchema = z.object({
  sessionId: sessionIdSchema.optional(),
  pokemonId: z.number().int().positive().optional(),
  category: z.enum([
    'accidental-answer',
    'unclear-question',
    'inaccurate-data',
    'missing-pokemon',
    'other',
  ]),
  detail: z.string().trim().max(2000).optional(),
});

export const pokemonNameQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
});
