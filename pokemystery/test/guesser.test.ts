import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  applyGuessRejected,
  chooseAction,
  findContradictions,
  initGuesser,
  scoreQuestions,
  undoLastAnswer,
  type EngineQuestion,
  type GuesserContext,
} from '../shared/engine/guesser';
import { DEFAULT_ENGINE_CONFIG } from '../shared/engine/config';
import { syntheticCandidate, testEvaluationContext } from './helpers';
import type { CandidatePokemon } from '../shared/types';

function makeContext(candidates: CandidatePokemon[], questions: EngineQuestion[]): GuesserContext {
  return {
    candidates,
    questionsById: new Map(questions.map((q) => [q.id, q])),
    evaluation: testEvaluationContext,
    config: DEFAULT_ENGINE_CONFIG,
  };
}

describe('scoreQuestions', () => {
  it('prefers a balanced high-information question over a heavily unbalanced one', () => {
    // 8 candidates: 4 fire / 4 water; exactly one is legendary.
    const candidates = Array.from({ length: 8 }, (_, i) =>
      syntheticCandidate(i + 1, {
        primaryType: i < 4 ? 'fire' : 'water',
        types: [i < 4 ? 'fire' : 'water'],
        isLegendary: i === 0,
      }),
    );
    const balanced: EngineQuestion = {
      id: 1,
      key: 'type-fire',
      text: 'Is it a Fire type?',
      category: 'type',
      query: { kind: 'type', type: 'fire' },
      reliability: 0.96,
      priority: 0,
    };
    const unbalanced: EngineQuestion = {
      id: 2,
      key: 'legendary',
      text: 'Is it a Legendary Pokémon?',
      category: 'category',
      query: { kind: 'legendary' },
      reliability: 0.96,
      priority: 0,
    };
    const ctx = makeContext(candidates, [balanced, unbalanced]);
    const state = initGuesser(candidates.map((c) => c.record.id), 20);
    const scored = scoreQuestions(state, ctx);
    expect(scored[0]?.question.key).toBe('type-fire');
    expect(scored[0]?.informationGain).toBeGreaterThan(scored[1]?.informationGain ?? Infinity * -1);
  });

  it('penalizes categories repeated in recent turns', () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      syntheticCandidate(i + 1, {
        primaryType: i < 4 ? 'fire' : 'water',
        types: [i < 4 ? 'fire' : 'water'],
        heightDecimeters: i % 2 === 0 ? 5 : 20,
      }),
    );
    const typeQuestion: EngineQuestion = {
      id: 1,
      key: 'type-fire',
      text: 'Is it a Fire type?',
      category: 'type',
      query: { kind: 'type', type: 'fire' },
      reliability: 0.9,
      priority: 0,
    };
    const typeQuestion2: EngineQuestion = {
      id: 2,
      key: 'type-water',
      text: 'Is it a Water type?',
      category: 'type',
      query: { kind: 'type', type: 'water' },
      reliability: 0.9,
      priority: 0,
    };
    const sizeQuestion: EngineQuestion = {
      id: 3,
      key: 'height-gt-10',
      text: 'Is it taller than 1 meter?',
      category: 'size',
      query: { kind: 'height', op: 'gt', decimeters: 10 },
      reliability: 0.9,
      priority: 0,
    };
    const ctx = makeContext(candidates, [typeQuestion, typeQuestion2, sizeQuestion]);
    let state = initGuesser(candidates.map((c) => c.record.id), 20);
    // Answer 'unknown' so the distribution stays uniform — only the category
    // repetition penalty differs between the two remaining questions.
    state = applyAnswer(state, typeQuestion.id, 'unknown', ctx);
    const scored = scoreQuestions(state, ctx);
    expect(scored[0]?.question.key).toBe('height-gt-10');
  });
});

describe('chooseAction', () => {
  it('asks questions while uncertain, then guesses once confident', () => {
    const candidates = Array.from({ length: 16 }, (_, i) =>
      syntheticCandidate(i + 1, {
        primaryType: i % 2 === 0 ? 'fire' : 'water',
        types: [i % 2 === 0 ? 'fire' : 'water'],
        isLegendary: i < 1,
      }),
    );
    const questions: EngineQuestion[] = [
      {
        id: 1,
        key: 'type-fire',
        text: 'Is it a Fire type?',
        category: 'type',
        query: { kind: 'type', type: 'fire' },
        reliability: 0.96,
        priority: 0,
      },
      {
        id: 2,
        key: 'legendary',
        text: 'Is it Legendary?',
        category: 'category',
        query: { kind: 'legendary' },
        reliability: 0.96,
        priority: 0,
      },
    ];
    const ctx = makeContext(candidates, questions);
    let state = initGuesser(candidates.map((c) => c.record.id), 20);
    expect(chooseAction(state, ctx).type).toBe('question');

    // Candidate 1 is the only legendary fire type: two answers pin it down.
    state = applyAnswer(state, 1, 'yes', ctx);
    state = applyAnswer(state, 2, 'yes', ctx);
    const action = chooseAction(state, ctx);
    expect(action).toEqual({ type: 'guess', pokemonId: 1 });
  });

  it('never re-guesses a rejected Pokémon and eventually concedes', () => {
    const candidates = [syntheticCandidate(1), syntheticCandidate(2)];
    const ctx = makeContext(candidates, []);
    let state = initGuesser([1, 2], 5);
    const guesses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const action = chooseAction(state, ctx);
      if (action.type === 'defeated') break;
      if (action.type === 'guess') {
        guesses.push(action.pokemonId);
        state = applyGuessRejected(state, action.pokemonId, ctx);
      }
    }
    expect(new Set(guesses).size).toBe(guesses.length); // no repeats
    expect(chooseAction(state, ctx).type).toBe('defeated');
  });
});

describe('undoLastAnswer', () => {
  it('restores the distribution to the pre-answer state', () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      syntheticCandidate(i + 1, {
        primaryType: i < 3 ? 'grass' : 'rock',
        types: [i < 3 ? 'grass' : 'rock'],
        canEvolve: i % 2 === 0,
      }),
    );
    const questions: EngineQuestion[] = [
      {
        id: 1,
        key: 'type-grass',
        text: 'Is it a Grass type?',
        category: 'type',
        query: { kind: 'type', type: 'grass' },
        reliability: 0.9,
        priority: 0,
      },
      {
        id: 2,
        key: 'can-evolve',
        text: 'Can it evolve?',
        category: 'evolution',
        query: { kind: 'can-evolve' },
        reliability: 0.9,
        priority: 0,
      },
    ];
    const ctx = makeContext(candidates, questions);
    let state = initGuesser(candidates.map((c) => c.record.id), 20);
    state = applyAnswer(state, 1, 'yes', ctx);
    const snapshot = [...state.probabilities];
    state = applyAnswer(state, 2, 'no', ctx);
    state = undoLastAnswer(state, ctx);
    expect(state.history).toHaveLength(1);
    state.probabilities.forEach((p, i) => expect(p).toBeCloseTo(snapshot[i] ?? -1, 10));
  });
});

describe('findContradictions', () => {
  it('flags answers that disagree with the revealed Pokémon', () => {
    const pikachuLike = syntheticCandidate(25, {
      primaryType: 'electric',
      types: ['electric'],
    });
    const question: EngineQuestion = {
      id: 1,
      key: 'type-electric',
      text: 'Is it an Electric type?',
      category: 'type',
      query: { kind: 'type', type: 'electric' },
      reliability: 0.96,
      priority: 0,
    };
    const ctx = makeContext([pikachuLike], [question]);
    let state = initGuesser([25], 20);
    state = applyAnswer(state, 1, 'no', ctx); // player answered wrong
    const contradictions = findContradictions(state, pikachuLike, ctx);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]?.expectedAnswer).toBe('yes');
  });
});
