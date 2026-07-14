/**
 * Bayesian probability updates, entropy, and information gain.
 * Pure functions over plain arrays; candidates never hit exactly zero, so no
 * single answer can permanently eliminate anyone.
 */

import type { PlayerAnswer } from '../types';
import type { AnswerLikelihood, EngineConfig } from './config';

/** Normalize in place-free fashion; returns uniform if all mass vanished. */
export function normalize(probabilities: readonly number[]): number[] {
  let total = 0;
  for (const p of probabilities) total += p;
  if (total <= 0 || !Number.isFinite(total)) {
    return probabilities.map(() => 1 / probabilities.length);
  }
  return probabilities.map((p) => p / total);
}

export function uniformDistribution(count: number): number[] {
  if (count <= 0) return [];
  return new Array<number>(count).fill(1 / count);
}

/**
 * P(player gives `answer` | candidate i), where matchProbability blends the
 * data's yes-probability with the question's reliability: an unreliable
 * question pulls responses toward a coin flip.
 */
export function answerProbability(
  matchProbability: number,
  reliability: number,
  likelihood: AnswerLikelihood,
): number {
  const effectiveMatch = reliability * matchProbability + (1 - reliability) * 0.5;
  return effectiveMatch * likelihood.matches + (1 - effectiveMatch) * likelihood.doesNotMatch;
}

/**
 * Bayesian update: posterior_i ∝ prior_i * P(answer | candidate_i).
 * `matchProbabilities` is aligned with `prior`.
 */
export function updateDistribution(
  prior: readonly number[],
  matchProbabilities: readonly number[],
  answer: PlayerAnswer,
  reliability: number,
  config: EngineConfig,
): number[] {
  const likelihood = config.likelihoods[answer];
  const posterior = prior.map((p, i) =>
    p * answerProbability(matchProbabilities[i] ?? 0.5, reliability, likelihood),
  );
  return normalize(posterior);
}

/** Shannon entropy in bits. */
export function entropy(probabilities: readonly number[]): number {
  let h = 0;
  for (const p of probabilities) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

export interface QuestionValue {
  /** Probability mass expected to answer yes. */
  yesMass: number;
  expectedEntropy: number;
  informationGain: number;
}

/**
 * Expected entropy after asking a question, modeling the player's answer as
 * binary yes/no (intermediate answers land between these posteriors).
 */
export function questionValue(
  prior: readonly number[],
  matchProbabilities: readonly number[],
  reliability: number,
): QuestionValue {
  let yesMass = 0;
  const yesPosterior = new Array<number>(prior.length);
  const noPosterior = new Array<number>(prior.length);
  for (let i = 0; i < prior.length; i += 1) {
    const p = prior[i] ?? 0;
    const m = matchProbabilities[i] ?? 0.5;
    const effective = reliability * m + (1 - reliability) * 0.5;
    const yes = p * effective;
    yesMass += yes;
    yesPosterior[i] = yes;
    noPosterior[i] = p - yes;
  }
  const currentEntropy = entropy(prior);
  const noMass = 1 - yesMass;
  const entropyYes = yesMass > 0 ? entropy(normalize(yesPosterior)) : 0;
  const entropyNo = noMass > 0 ? entropy(normalize(noPosterior)) : 0;
  const expectedEntropy = yesMass * entropyYes + noMass * entropyNo;
  return {
    yesMass,
    expectedEntropy,
    informationGain: currentEntropy - expectedEntropy,
  };
}
