/** Human-readable restatement of a structured query (for UI transparency). */

import type { StructuredQuery } from '../query';

const OP_WORDS: Record<string, string> = {
  eq: 'exactly',
  gt: 'more than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
};

export function describeQuery(query: StructuredQuery, negated: boolean): string {
  const base = describePositive(query);
  return negated ? `NOT: ${base}` : base;
}

function describePositive(query: StructuredQuery): string {
  switch (query.kind) {
    case 'type':
      return `Is it a ${query.type} type?`;
    case 'dual-type':
      return 'Does it have two types?';
    case 'generation':
      return `Was it introduced in generation ${OP_WORDS[query.op] ?? ''} ${query.generation}?`.replace('exactly ', '');
    case 'legendary':
      return 'Is it a Legendary Pokémon?';
    case 'mythical':
      return 'Is it a Mythical Pokémon?';
    case 'legendary-or-mythical':
      return 'Is it Legendary or Mythical?';
    case 'baby':
      return 'Is it a baby Pokémon?';
    case 'starter':
      return 'Is it a starter Pokémon or one of its evolutions?';
    case 'can-evolve':
      return 'Can it still evolve?';
    case 'fully-evolved':
      return 'Is it fully evolved?';
    case 'has-pre-evolution':
      return 'Did it evolve from another Pokémon?';
    case 'middle-evolution':
      return 'Is it a middle evolution?';
    case 'branching-evolution':
      return 'Does its evolution line branch?';
    case 'evolution-stage':
      return `Is it evolution stage ${query.stage}?`;
    case 'in-evolution-line-of':
      return 'Is it in that evolution line?';
    case 'height':
      return `Is its height ${OP_WORDS[query.op] ?? ''} ${query.decimeters / 10} m?`;
    case 'weight':
      return `Is its weight ${OP_WORDS[query.op] ?? ''} ${query.hectograms / 10} kg?`;
    case 'stat-total':
      return `Is its base stat total ${OP_WORDS[query.op] ?? ''} ${query.value}?`;
    case 'color':
      return `Is it mostly ${query.color}?`;
    case 'habitat':
      return `Does it live in the ${query.habitat.replaceAll('-', ' ')} habitat?`;
    case 'trait':
      return `Trait check: ${query.trait.replaceAll('-', ' ')}?`;
    case 'egg-group':
      return `Is it in the ${query.eggGroup} egg group?`;
    case 'ability':
      return `Can it have the ability ${query.ability.replaceAll('-', ' ')}?`;
    case 'genderless':
      return 'Is it genderless?';
    case 'single-gender':
      return `Is it always ${query.gender}?`;
    case 'name-guess':
      return 'Is it that Pokémon?';
    case 'name-letter':
      return `Does its name ${query.position === 'ends' ? 'end' : query.position === 'starts' ? 'start' : 'contain'} ${query.position === 'contains' ? '' : 'with '}"${query.letter}"?`;
  }
}
