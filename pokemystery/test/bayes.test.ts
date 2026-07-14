import { describe, expect, it } from 'vitest';
import {
  answerProbability,
  entropy,
  normalize,
  questionValue,
  uniformDistribution,
  updateDistribution,
} from '../shared/engine/bayes';
import { ANSWER_LIKELIHOODS, DEFAULT_ENGINE_CONFIG } from '../shared/engine/config';

describe('entropy', () => {
  it('is log2(n) for a uniform distribution', () => {
    expect(entropy(uniformDistribution(8))).toBeCloseTo(3, 10);
    expect(entropy(uniformDistribution(1024))).toBeCloseTo(10, 10);
  });

  it('is 0 for a certain outcome', () => {
    expect(entropy([1, 0, 0, 0])).toBe(0);
  });
});

describe('normalize', () => {
  it('sums to 1', () => {
    const normalized = normalize([0.5, 0.25, 0.25, 1]);
    expect(normalized.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('falls back to uniform when all mass vanishes', () => {
    expect(normalize([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe('answerProbability', () => {
  it('matches the likelihood table at full reliability', () => {
    expect(answerProbability(1, 1, ANSWER_LIKELIHOODS.yes)).toBeCloseTo(0.98, 10);
    expect(answerProbability(0, 1, ANSWER_LIKELIHOODS.yes)).toBeCloseTo(0.02, 10);
  });

  it('degrades toward a coin flip as reliability drops', () => {
    expect(answerProbability(1, 0, ANSWER_LIKELIHOODS.yes)).toBeCloseTo(0.5, 10);
  });
});

describe('updateDistribution', () => {
  it('boosts matching candidates on yes and never eliminates anyone', () => {
    const prior = uniformDistribution(4);
    const matches = [1, 1, 0, 0];
    const posterior = updateDistribution(prior, matches, 'yes', 1, DEFAULT_ENGINE_CONFIG);
    expect(posterior[0]).toBeGreaterThan(0.4);
    expect(posterior[2]).toBeGreaterThan(0); // never exactly zero
    expect(posterior[2]).toBeLessThan(0.05);
    expect(posterior.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('unknown answers leave the distribution untouched', () => {
    const prior = [0.7, 0.2, 0.1];
    const posterior = updateDistribution(prior, [1, 0, 1], 'unknown', 1, DEFAULT_ENGINE_CONFIG);
    expect(posterior[0]).toBeCloseTo(0.7, 10);
    expect(posterior[1]).toBeCloseTo(0.2, 10);
  });

  it('is symmetric: probably-yes then undo-equivalent probably-no restores balance', () => {
    const prior = uniformDistribution(2);
    const afterYes = updateDistribution(prior, [1, 0], 'probably-yes', 1, DEFAULT_ENGINE_CONFIG);
    expect(afterYes[0]).toBeCloseTo(0.75, 10);
  });
});

describe('questionValue / information gain', () => {
  it('a perfect half-split of a uniform prior gains exactly 1 bit', () => {
    const prior = uniformDistribution(8);
    const value = questionValue(prior, [1, 1, 1, 1, 0, 0, 0, 0], 1);
    expect(value.yesMass).toBeCloseTo(0.5, 10);
    expect(value.informationGain).toBeCloseTo(1, 10);
  });

  it('an unbalanced 1/8 split gains less than the half split', () => {
    const prior = uniformDistribution(8);
    const balanced = questionValue(prior, [1, 1, 1, 1, 0, 0, 0, 0], 1);
    const unbalanced = questionValue(prior, [1, 0, 0, 0, 0, 0, 0, 0], 1);
    expect(unbalanced.informationGain).toBeLessThan(balanced.informationGain);
    expect(unbalanced.informationGain).toBeGreaterThan(0);
  });

  it('a question everyone matches gains nothing', () => {
    const prior = uniformDistribution(4);
    const value = questionValue(prior, [1, 1, 1, 1], 1);
    expect(value.informationGain).toBeCloseTo(0, 10);
  });

  it('low reliability reduces information gain', () => {
    const prior = uniformDistribution(8);
    const matches = [1, 1, 1, 1, 0, 0, 0, 0];
    const reliable = questionValue(prior, matches, 1);
    const unreliable = questionValue(prior, matches, 0.6);
    expect(unreliable.informationGain).toBeLessThan(reliable.informationGain);
  });
});
