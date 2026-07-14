/**
 * End-to-end engine simulations against the real Gen 1 fixture dataset:
 * a truthful simulated player picks a secret Pokémon, the engine asks its
 * questions, and we measure how often (and how fast) it wins.
 */

import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  applyGuessRejected,
  chooseAction,
  initGuesser,
  type EngineQuestion,
  type GuesserContext,
} from '../shared/engine/guesser';
import { DEFAULT_ENGINE_CONFIG } from '../shared/engine/config';
import { matchProbability } from '../shared/engine/evaluate';
import { buildQuestionBank } from '../shared/engine/question-bank';
import { loadFixturePokemon, testEvaluationContext } from './helpers';
import type { CandidatePokemon, PlayerAnswer } from '../shared/types';

const MAX_QUESTIONS = 20;

/** A truthful player: answers from the same data the engine uses. */
function truthfulAnswer(question: EngineQuestion, secret: CandidatePokemon): PlayerAnswer {
  const m = matchProbability(question.query, secret, testEvaluationContext);
  if (m >= 0.95) return 'yes';
  if (m >= 0.6) return 'probably-yes';
  if (m > 0.4) return 'unknown';
  if (m > 0.05) return 'probably-no';
  return 'no';
}

interface SimulationResult {
  won: boolean;
  questions: number;
  guesses: number;
}

function simulate(secret: CandidatePokemon, ctx: GuesserContext): SimulationResult {
  let state = initGuesser(
    ctx.candidates.map((c) => c.record.id),
    MAX_QUESTIONS,
  );
  let guesses = 0;
  for (let turn = 0; turn < MAX_QUESTIONS + DEFAULT_ENGINE_CONFIG.maxTotalGuesses + 2; turn += 1) {
    const action = chooseAction(state, ctx);
    if (action.type === 'defeated') {
      return { won: false, questions: state.history.length, guesses };
    }
    if (action.type === 'guess') {
      guesses += 1;
      if (action.pokemonId === secret.record.id) {
        return { won: true, questions: state.history.length, guesses };
      }
      state = applyGuessRejected(state, action.pokemonId, ctx);
      continue;
    }
    const question = ctx.questionsById.get(action.questionId);
    if (question === undefined) throw new Error('engine chose unknown question');
    state = applyAnswer(state, action.questionId, truthfulAnswer(question, secret), ctx);
  }
  return { won: false, questions: state.history.length, guesses };
}

describe('engine simulation on the Gen 1 fixture (151 candidates)', () => {
  const candidates = loadFixturePokemon();
  const bank = buildQuestionBank();
  const questions: EngineQuestion[] = bank.map((q, index) => ({ ...q, id: index + 1 }));
  const ctx: GuesserContext = {
    candidates,
    questionsById: new Map(questions.map((q) => [q.id, q])),
    evaluation: testEvaluationContext,
    config: DEFAULT_ENGINE_CONFIG,
  };

  it('identifies a well-known Pokémon quickly (Pikachu)', () => {
    const secret = candidates.find((c) => c.record.name === 'pikachu');
    expect(secret).toBeDefined();
    if (secret === undefined) return;
    const result = simulate(secret, ctx);
    expect(result.won).toBe(true);
    expect(result.questions).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('wins most games against a truthful player within the question budget', () => {
    // Every 3rd Pokémon → 51 simulated games across all of Gen 1.
    const secrets = candidates.filter((_, index) => index % 3 === 0);
    const results = secrets.map((secret) => simulate(secret, ctx));
    const wins = results.filter((r) => r.won).length;
    const winRate = wins / results.length;
    const averageQuestions =
      results.reduce((sum, r) => sum + r.questions, 0) / results.length;

    // Diagnostics on failure.
    if (winRate < 0.9) {
      const losses = secrets
        .filter((_, i) => !(results[i]?.won ?? false))
        .map((s) => s.record.name);
      console.error('losses:', losses.join(', '));
    }
    expect(winRate).toBeGreaterThanOrEqual(0.9);
    expect(averageQuestions).toBeLessThanOrEqual(MAX_QUESTIONS);
  });
});
