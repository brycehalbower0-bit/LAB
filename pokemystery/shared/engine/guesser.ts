/**
 * The Mode 1 guessing engine: question selection by information gain, guess
 * policy, answer updates, undo-by-replay, and contradiction analysis.
 *
 * Everything is pure: state in, state out. The Worker persists GuesserState
 * as JSON in the game session; clients only ever see a session token.
 */

import type { CandidatePokemon, PlayerAnswer } from '../types';
import type { StructuredQuery } from '../query';
import { matchProbability, type EvaluationContext } from './evaluate';
import { entropy, normalize, questionValue, uniformDistribution, updateDistribution } from './bayes';
import type { EngineConfig } from './config';

export interface EngineQuestion {
  id: number;
  key: string;
  text: string;
  category: string;
  query: StructuredQuery;
  reliability: number;
  priority: number;
}

export interface GuesserState {
  candidateIds: number[];
  probabilities: number[];
  history: { questionId: number; answer: PlayerAnswer }[];
  /** Pokémon ids the engine has guessed, in order (rejected unless game ended). */
  guessedPokemonIds: number[];
  currentQuestionId: number | null;
  maxQuestions: number;
}

export type GuesserAction =
  | { type: 'question'; questionId: number }
  | { type: 'guess'; pokemonId: number }
  | { type: 'defeated' };

export interface GuesserContext {
  /** Aligned with state.candidateIds. */
  candidates: CandidatePokemon[];
  questionsById: ReadonlyMap<number, EngineQuestion>;
  evaluation: EvaluationContext;
  config: EngineConfig;
}

export function initGuesser(candidateIds: number[], maxQuestions: number): GuesserState {
  return {
    candidateIds,
    probabilities: uniformDistribution(candidateIds.length),
    history: [],
    guessedPokemonIds: [],
    currentQuestionId: null,
    maxQuestions,
  };
}

function matchVector(question: EngineQuestion, ctx: GuesserContext): number[] {
  return ctx.candidates.map((candidate) =>
    matchProbability(question.query, candidate, ctx.evaluation),
  );
}

export interface ScoredQuestion {
  question: EngineQuestion;
  score: number;
  informationGain: number;
  yesMass: number;
}

/**
 * Score every unused enabled question: information gain discounted by
 * reliability, category repetition, imbalance, and the question's own
 * priority tweak.
 */
export function scoreQuestions(state: GuesserState, ctx: GuesserContext): ScoredQuestion[] {
  const { config } = ctx;
  const asked = new Set(state.history.map((h) => h.questionId));
  const recentCategories = state.history
    .slice(-3)
    .map((h) => ctx.questionsById.get(h.questionId)?.category)
    .filter((category): category is string => category !== undefined);

  const scored: ScoredQuestion[] = [];
  for (const question of ctx.questionsById.values()) {
    if (asked.has(question.id)) continue;
    const value = questionValue(state.probabilities, matchVector(question, ctx), question.reliability);
    let score = value.informationGain * Math.pow(question.reliability, config.reliabilityExponent);
    // Repetitive categories get stale for players.
    const repeats = recentCategories.filter((category) => category === question.category).length;
    score *= Math.pow(config.categoryRepeatPenalty, repeats);
    // Extremely unbalanced questions are near-useless (and often already
    // implied by previous answers, which is what pushed them lopsided).
    if (value.yesMass < config.unbalancedLow || value.yesMass > config.unbalancedHigh) {
      score *= config.unbalancedPenalty;
    }
    score += question.priority;
    scored.push({ question, score, informationGain: value.informationGain, yesMass: value.yesMass });
  }
  return scored.sort((a, b) => b.score - a.score);
}

interface TopCandidates {
  topIndex: number;
  topProbability: number;
  secondProbability: number;
  /** Perplexity: the effective number of remaining candidates. */
  perplexity: number;
}

function topCandidates(state: GuesserState, _config: EngineConfig): TopCandidates {
  let topIndex = 0;
  let top = -1;
  let second = 0;
  for (let i = 0; i < state.probabilities.length; i += 1) {
    const p = state.probabilities[i] ?? 0;
    if (p > top) {
      second = top;
      top = p;
      topIndex = i;
    } else if (p > second) {
      second = p;
    }
  }
  return {
    topIndex,
    topProbability: top,
    secondProbability: second,
    perplexity: Math.pow(2, entropy(state.probabilities)),
  };
}

/** Pick the Pokémon to guess: highest probability not yet over-guessed. */
function pickGuess(state: GuesserState, ctx: GuesserContext): number | null {
  const guessCounts = new Map<number, number>();
  for (const id of state.guessedPokemonIds) {
    guessCounts.set(id, (guessCounts.get(id) ?? 0) + 1);
  }
  let bestId: number | null = null;
  let bestProbability = -1;
  for (let i = 0; i < state.candidateIds.length; i += 1) {
    const id = state.candidateIds[i];
    const p = state.probabilities[i] ?? 0;
    if (id === undefined) continue;
    if ((guessCounts.get(id) ?? 0) >= ctx.config.maxSameGuess) continue;
    if (p > bestProbability) {
      bestProbability = p;
      bestId = id;
    }
  }
  return bestId;
}

/** Decide the next move: ask, guess, or concede. */
export function chooseAction(state: GuesserState, ctx: GuesserContext): GuesserAction {
  const { config } = ctx;
  const stats = topCandidates(state, config);
  const scored = scoreQuestions(state, ctx);
  const best = scored[0];

  const guessesExhausted = state.guessedPokemonIds.length >= config.maxTotalGuesses;
  const outOfQuestions = state.history.length >= state.maxQuestions || best === undefined;

  const shouldGuess =
    outOfQuestions ||
    stats.topProbability >= config.guessThreshold ||
    (stats.topProbability >= config.guessLeadRatio * stats.secondProbability &&
      stats.topProbability >= config.guessLeadMinimum) ||
    stats.perplexity <= config.perplexityGuessFloor ||
    (best.informationGain < config.minUsefulInformationGain &&
      stats.topProbability >= config.lowGainGuessMinimum);

  if (shouldGuess) {
    if (guessesExhausted && outOfQuestions) return { type: 'defeated' };
    if (!guessesExhausted) {
      const pokemonId = pickGuess(state, ctx);
      if (pokemonId !== null) return { type: 'guess', pokemonId };
      return { type: 'defeated' };
    }
    // Guesses exhausted but questions remain — keep asking.
  }
  if (best === undefined) return { type: 'defeated' };
  return { type: 'question', questionId: best.question.id };
}

/** Apply the player's answer to the current question. */
export function applyAnswer(
  state: GuesserState,
  questionId: number,
  answer: PlayerAnswer,
  ctx: GuesserContext,
): GuesserState {
  const question = ctx.questionsById.get(questionId);
  if (question === undefined) {
    throw new Error(`Unknown question id ${questionId}`);
  }
  const probabilities = updateDistribution(
    state.probabilities,
    matchVector(question, ctx),
    answer,
    question.reliability,
    ctx.config,
  );
  return {
    ...state,
    probabilities,
    history: [...state.history, { questionId, answer }],
    currentQuestionId: null,
  };
}

/** The engine's guess was rejected: crush its probability and continue. */
export function applyGuessRejected(
  state: GuesserState,
  pokemonId: number,
  ctx: GuesserContext,
): GuesserState {
  const index = state.candidateIds.indexOf(pokemonId);
  const probabilities = [...state.probabilities];
  if (index >= 0) {
    probabilities[index] = (probabilities[index] ?? 0) * ctx.config.rejectedGuessPenalty;
  }
  return {
    ...state,
    probabilities: normalize(probabilities),
    guessedPokemonIds: [...state.guessedPokemonIds, pokemonId],
  };
}

/**
 * Undo the most recent answer by replaying the rest from a uniform prior —
 * cheap, exact, and avoids storing a distribution snapshot per turn.
 */
export function undoLastAnswer(state: GuesserState, ctx: GuesserContext): GuesserState {
  if (state.history.length === 0) return state;
  const history = state.history.slice(0, -1);
  let replayed: GuesserState = {
    ...initGuesser(state.candidateIds, state.maxQuestions),
    guessedPokemonIds: state.guessedPokemonIds,
  };
  for (const entry of history) {
    replayed = applyAnswer(replayed, entry.questionId, entry.answer, ctx);
  }
  for (const id of state.guessedPokemonIds) {
    replayed = applyGuessRejected(replayed, id, ctx);
  }
  return replayed;
}

export interface Contradiction {
  questionId: number;
  questionText: string;
  playerAnswer: PlayerAnswer;
  expectedAnswer: 'yes' | 'no';
}

/** After the player reveals their Pokémon, find answers the data disagrees with. */
export function findContradictions(
  state: GuesserState,
  revealed: CandidatePokemon,
  ctx: GuesserContext,
): Contradiction[] {
  const contradictions: Contradiction[] = [];
  for (const entry of state.history) {
    const question = ctx.questionsById.get(entry.questionId);
    if (question === undefined) continue;
    const m = matchProbability(question.query, revealed, ctx.evaluation);
    const saidYes = entry.answer === 'yes' || entry.answer === 'probably-yes';
    const saidNo = entry.answer === 'no' || entry.answer === 'probably-no';
    if (saidYes && m <= 0.2) {
      contradictions.push({
        questionId: question.id,
        questionText: question.text,
        playerAnswer: entry.answer,
        expectedAnswer: 'no',
      });
    } else if (saidNo && m >= 0.8) {
      contradictions.push({
        questionId: question.id,
        questionText: question.text,
        playerAnswer: entry.answer,
        expectedAnswer: 'yes',
      });
    }
  }
  return contradictions;
}

/** Diagnostic used by tests and simulations. */
export function stateEntropy(state: GuesserState): number {
  return entropy(state.probabilities);
}
