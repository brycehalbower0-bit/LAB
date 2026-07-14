import { describe, expect, it } from 'vitest';
import {
  editDistance,
  lookupPokemonName,
  normalizePokemonName,
  parsePlayerQuestion,
  type ParserContext,
} from '../shared/parser/parse';
import { answerQuestion } from '../shared/engine/evaluate';
import { TRAIT_KINDS } from '../shared/traits';
import { loadFixturePokemon, testEvaluationContext } from './helpers';
import type { StructuredQuery } from '../shared/query';

const fixture = loadFixturePokemon();
const ctx: ParserContext = {
  nameToId: new Map(fixture.map((c) => [normalizePokemonName(c.record.name), c.record.id])),
};

function q(text: string): { query: StructuredQuery; negated: boolean } {
  const parsed = parsePlayerQuestion(text, ctx);
  expect(parsed, `should parse: "${text}"`).not.toBeNull();
  if (parsed === null) throw new Error('unreachable');
  return parsed.question;
}

describe('deterministic parser — mandated examples', () => {
  it('parses type questions in several phrasings', () => {
    expect(q('Is it electric?')).toEqual({ query: { kind: 'type', type: 'electric' }, negated: false });
    expect(q('Is it an Electric type?').query).toEqual({ kind: 'type', type: 'electric' });
    expect(q('Does it have the electric typing?').query).toEqual({ kind: 'type', type: 'electric' });
    expect(q('Is it a Water type?').query).toEqual({ kind: 'type', type: 'water' });
  });

  it('parses generation and region questions', () => {
    expect(q('Was it introduced in Gen 4?').query).toEqual({ kind: 'generation', op: 'eq', generation: 4 });
    expect(q('Is it from Sinnoh?').query).toEqual({ kind: 'generation', op: 'eq', generation: 4 });
    expect(q('Was it introduced in Sinnoh?').query).toEqual({ kind: 'generation', op: 'eq', generation: 4 });
    expect(q('Is it older than Unova?').query).toEqual({ kind: 'generation', op: 'lt', generation: 5 });
    expect(q('was it introduced in generation four')?.query).toEqual({ kind: 'generation', op: 'eq', generation: 4 });
  });

  it('parses evolution questions', () => {
    expect(q('Can it evolve?').query).toEqual({ kind: 'can-evolve' });
    expect(q('Is it fully evolved?').query).toEqual({ kind: 'fully-evolved' });
    expect(q('Is it a middle evolution?').query).toEqual({ kind: 'middle-evolution' });
    expect(q('Does it have a pre-evolution?').query).toEqual({ kind: 'has-pre-evolution' });
  });

  it('parses category questions', () => {
    expect(q('Is it legendary?').query).toEqual({ kind: 'legendary' });
    expect(q('Is it mythical?').query).toEqual({ kind: 'mythical' });
    expect(q('Is it a baby pokemon?').query).toEqual({ kind: 'baby' });
    expect(q('Is it a starter?').query).toEqual({ kind: 'starter' });
  });

  it('parses trait, color, and dimension questions', () => {
    expect(q('Does it have four legs?').query).toEqual({ kind: 'trait', trait: 'four-legged' });
    expect(q('Does it have wings?').query).toEqual({ kind: 'trait', trait: 'has-wings' });
    expect(q('Is it blue?').query).toEqual({ kind: 'color', color: 'blue' });
    expect(q('Is it taller than 1 meter?').query).toEqual({ kind: 'height', op: 'gt', decimeters: 10 });
    expect(q('Is it heavier than 50 kilograms?').query).toEqual({ kind: 'weight', op: 'gt', hectograms: 500 });
    expect(q('Is it shorter than 50 cm?').query).toEqual({ kind: 'height', op: 'lt', decimeters: 5 });
  });

  it('parses direct name guesses, including misspellings', () => {
    expect(q('Is it Pikachu?').query).toEqual({ kind: 'name-guess', pokemonId: 25 });
    expect(q('Is it Dragonair?').query).toEqual({ kind: 'name-guess', pokemonId: 148 });
    expect(q('is it charzard').query).toEqual({ kind: 'name-guess', pokemonId: 6 }); // 1 typo
    expect(q('bulbasaur').query).toEqual({ kind: 'name-guess', pokemonId: 1 });
  });

  it('handles negation', () => {
    expect(q('Is it not a fire type?')).toEqual({ query: { kind: 'type', type: 'fire' }, negated: true });
    expect(q("Isn't it legendary?").negated).toBe(true);
  });

  it('parses dual/mono type questions', () => {
    expect(q('Does it have two types?')).toEqual({ query: { kind: 'dual-type' }, negated: false });
    expect(q('Is it a single type pokemon?').negated).toBe(true);
  });

  it('parses gender and misc questions', () => {
    expect(q('Is it genderless?').query).toEqual({ kind: 'genderless' });
    expect(q('Is it always female?').query).toEqual({ kind: 'single-gender', gender: 'female' });
    expect(q('Does its name start with the letter p?').query).toEqual({
      kind: 'name-letter',
      letter: 'p',
      position: 'starts',
    });
  });

  it('returns null for unparseable input (AI fallback / rephrase)', () => {
    expect(parsePlayerQuestion('Would it beat a truck in a fight?', ctx)).toBeNull();
    expect(parsePlayerQuestion('asdf qwerty', ctx)).toBeNull();
  });
});

describe('name utilities', () => {
  it('normalizes tricky names', () => {
    expect(normalizePokemonName("Farfetch'd")).toBe('farfetchd');
    expect(normalizePokemonName('Mr. Mime')).toBe('mr-mime');
    expect(normalizePokemonName('Nidoran♀')).toBe('nidoran-f');
  });

  it('editDistance respects the cap', () => {
    expect(editDistance('pikachu', 'pikachu', 2)).toBe(0);
    expect(editDistance('pikachu', 'pikuchu', 2)).toBe(1);
    expect(editDistance('pikachu', 'raichu', 2)).toBeGreaterThan(2);
  });

  it('lookup requires reasonable length before fuzzy matching', () => {
    expect(lookupPokemonName('mew', ctx)?.id).toBe(151);
    expect(lookupPokemonName('mrw', ctx)).toBeNull(); // no fuzzy at length 3
  });
});

describe('parser + evaluator integration (answers about a secret Pokémon)', () => {
  const byName = new Map(fixture.map((c) => [c.record.name, c]));
  const pikachu = byName.get('pikachu');
  const charizard = byName.get('charizard');
  const evalCtx = { ...testEvaluationContext, traitKinds: TRAIT_KINDS };

  it('answers Pikachu questions correctly', () => {
    if (pikachu === undefined) throw new Error('fixture missing pikachu');
    expect(answerQuestion(q('Is it electric?'), pikachu, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it a water type?'), pikachu, evalCtx)).toBe('no');
    expect(answerQuestion(q('Can it evolve?'), pikachu, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it legendary?'), pikachu, evalCtx)).toBe('no');
    expect(answerQuestion(q('Is it not a fire type?'), pikachu, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it yellow?'), pikachu, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it taller than 1 meter?'), pikachu, evalCtx)).toBe('no');
    expect(answerQuestion(q('Is it Pikachu?'), pikachu, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it Bulbasaur?'), pikachu, evalCtx)).toBe('no');
  });

  it('answers Charizard questions correctly', () => {
    if (charizard === undefined) throw new Error('fixture missing charizard');
    expect(answerQuestion(q('Is it fully evolved?'), charizard, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it a starter?'), charizard, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Does it have wings?'), charizard, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Is it heavier than 50 kilograms?'), charizard, evalCtx)).toBe('yes');
    expect(answerQuestion(q('Was it introduced in Gen 4?'), charizard, evalCtx)).toBe('no');
    expect(answerQuestion(q('Is it older than Unova?'), charizard, evalCtx)).toBe('yes');
  });

  it('answers sometimes for mixed-gender single-gender questions', () => {
    if (pikachu === undefined) throw new Error('fixture missing pikachu');
    expect(answerQuestion(q('Is it always female?'), pikachu, evalCtx)).toBe('sometimes');
  });

  it('answers unknown for subjective traits with no data', () => {
    // Magikarp has no curated 'cute' assignment in the derived-only fixture.
    const magikarp = byName.get('magikarp');
    if (magikarp === undefined) throw new Error('fixture missing magikarp');
    expect(answerQuestion(q('Is it cute?'), magikarp, evalCtx)).toBe('unknown');
  });
});
