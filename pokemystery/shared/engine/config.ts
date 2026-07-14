/**
 * Tunable engine configuration. Everything the guesser does is parameterized
 * here so behavior can be tuned through tests and simulations.
 */

import type { PlayerAnswer } from '../types';

export interface AnswerLikelihood {
  /** P(player gives this answer | the fact matches the Pokémon). */
  matches: number;
  /** P(player gives this answer | the fact does not match). */
  doesNotMatch: number;
}

export const ANSWER_LIKELIHOODS: Readonly<Record<PlayerAnswer, AnswerLikelihood>> = {
  yes: { matches: 0.98, doesNotMatch: 0.02 },
  'probably-yes': { matches: 0.75, doesNotMatch: 0.25 },
  unknown: { matches: 0.5, doesNotMatch: 0.5 },
  'probably-no': { matches: 0.25, doesNotMatch: 0.75 },
  no: { matches: 0.02, doesNotMatch: 0.98 },
};

export interface EngineConfig {
  likelihoods: Readonly<Record<PlayerAnswer, AnswerLikelihood>>;
  /** Guess when the top candidate reaches this probability. */
  guessThreshold: number;
  /** ...or when top >= leadRatio * second and top >= guessLeadMinimum. */
  guessLeadRatio: number;
  guessLeadMinimum: number;
  /**
   * Guess when the distribution's perplexity (2^entropy — the "effective
   * number of remaining candidates") drops to this value or below.
   */
  perplexityGuessFloor: number;
  /** Guess when the best question's information gain drops below this (bits). */
  minUsefulInformationGain: number;
  /** ...but only if the top candidate has at least this probability. */
  lowGainGuessMinimum: number;
  /** Multiplier applied to a candidate's probability when its guess is rejected. */
  rejectedGuessPenalty: number;
  /** Maximum times the engine may guess the same Pokémon per game. */
  maxSameGuess: number;
  /** Maximum total guesses before conceding defeat. */
  maxTotalGuesses: number;
  /** Score multiplier per occurrence of the question's category in the last 3 turns. */
  categoryRepeatPenalty: number;
  /** Penalty multiplier for questions whose expected yes-probability is extreme. */
  unbalancedPenalty: number;
  unbalancedLow: number;
  unbalancedHigh: number;
  /** Blend factor: how much reliability discounts information gain. */
  reliabilityExponent: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  likelihoods: ANSWER_LIKELIHOODS,
  guessThreshold: 0.82,
  guessLeadRatio: 2.5,
  guessLeadMinimum: 0.45,
  perplexityGuessFloor: 2.5,
  minUsefulInformationGain: 0.03,
  lowGainGuessMinimum: 0.3,
  rejectedGuessPenalty: 0.02,
  maxSameGuess: 1,
  maxTotalGuesses: 3,
  categoryRepeatPenalty: 0.85,
  unbalancedPenalty: 0.6,
  unbalancedLow: 0.03,
  unbalancedHigh: 0.97,
  reliabilityExponent: 1.5,
};
