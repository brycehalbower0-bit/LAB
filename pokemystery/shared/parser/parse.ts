/**
 * Deterministic natural-language question parser (Stage 1).
 *
 * Turns free-text player questions into StructuredQuery values without any
 * AI. Rules are ordered from most to least specific; the first match wins.
 * Returns null when nothing matches — the caller may then consult the
 * optional AI fallback parser (Stage 2), whose output is validated against
 * the same StructuredQuery schema and evaluated by the same engine.
 */

import type { ParsedQuestion, StructuredQuery, ComparisonOp } from '../query';
import {
  COLOR_WORDS,
  CONTRACTIONS,
  GENERATION_ALIASES,
  HABITAT_ALIASES,
  NUMBER_WORDS,
  TRAIT_PHRASES,
  TYPE_ALIASES,
} from './lexicon';

export interface ParserContext {
  /** normalized name (see normalizePokemonName) -> pokemon id */
  nameToId: ReadonlyMap<string, number>;
}

export interface ParseSuccess {
  question: ParsedQuestion;
  /** Human-readable restatement shown to the player for transparency. */
  interpreted: string;
}

export function normalizePokemonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[♀]/g, '-f')
    .replace(/[♂]/g, '-m')
    .replace(/['".:]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeText(raw: string): string {
  let text = raw.toLowerCase();
  for (const [pattern, replacement] of CONTRACTIONS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/[?!.,;:"()]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/** Levenshtein distance with early exit; small inputs only. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? Infinity) + 1,
        (current[j - 1] ?? Infinity) + 1,
        (previous[j - 1] ?? Infinity) + cost,
      );
      rowMin = Math.min(rowMin, current[j] ?? Infinity);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? 0;
  }
  return previous[b.length] ?? max + 1;
}

/** Find a Pokémon by (possibly misspelled) name. Exact match wins. */
export function lookupPokemonName(
  candidate: string,
  ctx: ParserContext,
): { id: number; matchedName: string } | null {
  const normalized = normalizePokemonName(candidate);
  if (normalized.length < 3) return null;
  const exact = ctx.nameToId.get(normalized);
  if (exact !== undefined) return { id: exact, matchedName: normalized };
  const maxDistance = normalized.length >= 10 ? 2 : normalized.length >= 6 ? 1 : 0;
  if (maxDistance === 0) return null;
  let best: { id: number; matchedName: string; distance: number } | null = null;
  for (const [name, id] of ctx.nameToId) {
    const distance = editDistance(normalized, name, maxDistance);
    if (distance <= maxDistance && (best === null || distance < best.distance)) {
      best = { id, matchedName: name, distance };
      if (distance === 1) break;
    }
  }
  return best === null ? null : { id: best.id, matchedName: best.matchedName };
}

interface RuleResult {
  query: StructuredQuery;
  interpreted: string;
  /** Some rules express negation themselves ("only one type"). */
  flipNegation?: boolean;
}

type Rule = (text: string, ctx: ParserContext) => RuleResult | null;

function parseNumber(token: string): number | null {
  const word = NUMBER_WORDS[token];
  if (word !== undefined) return word;
  if (token === 'a' || token === 'an') return 1;
  const value = Number(token);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const NUM = String.raw`(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an)`;
const HEIGHT_UNIT = String.raw`(m|meter|meters|metre|metres|cm|centimeter|centimeters|dm|decimeter|decimeters|ft|foot|feet|inch|inches)`;
const WEIGHT_UNIT = String.raw`(kg|kilogram|kilograms|kilo|kilos|g|gram|grams|lb|lbs|pound|pounds|ton|tons|tonne|tonnes)`;

function heightToDecimeters(value: number, unit: string): number {
  if (unit.startsWith('cm') || unit.startsWith('centi')) return value / 10;
  if (unit.startsWith('dm') || unit.startsWith('deci')) return value;
  if (unit === 'ft' || unit === 'foot' || unit === 'feet') return value * 3.048;
  if (unit.startsWith('inch')) return value * 0.254;
  return value * 10; // meters
}

function weightToHectograms(value: number, unit: string): number {
  if (unit === 'g' || unit.startsWith('gram')) return value / 100;
  if (unit.startsWith('lb') || unit.startsWith('pound')) return value * 4.53592;
  if (unit.startsWith('ton')) return value * 10_000;
  return value * 10; // kilograms
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

// --- rules, most specific first ---------------------------------------------

const ruleDualType: Rule = (text) => {
  if (/\b(?:dual|two|both|multiple|second) types?\b/.test(text) || /\bdual[\s-]typed?\b/.test(text)) {
    return { query: { kind: 'dual-type' }, interpreted: 'Does it have two types?' };
  }
  if (/\b(?:mono|single|only one|just one) types?d?\b/.test(text) || /\bmonotype\b/.test(text)) {
    return {
      query: { kind: 'dual-type' },
      interpreted: 'Does it have only one type?',
      flipNegation: true,
    };
  }
  return null;
};

const ruleType: Rule = (text) => {
  // "does it have the electric typing", "is it an electric type", "is it part water"
  const explicit =
    /\b(?:a |an |the |part )?([a-z]+)(?:[\s-](?:type|typed|typing|pokemon))\b/.exec(text) ??
    /\bhave (?:the )?([a-z]+) (?:type|typing)\b/.exec(text);
  const explicitAlias = explicit?.[1] !== undefined ? TYPE_ALIASES[explicit[1]] : undefined;
  if (explicitAlias !== undefined) {
    return {
      query: { kind: 'type', type: explicitAlias },
      interpreted: `Is it a ${capitalize(explicitAlias)} type?`,
    };
  }
  // bare "is it electric" — only when the whole question is just the type word
  const bare = /^(?:is it |was it )(?:a |an )?([a-z]+)$/.exec(text);
  const bareAlias = bare?.[1] !== undefined ? TYPE_ALIASES[bare[1]] : undefined;
  if (bareAlias !== undefined) {
    return {
      query: { kind: 'type', type: bareAlias },
      interpreted: `Is it a ${capitalize(bareAlias)} type?`,
    };
  }
  if (/\bcan it fly\b/.test(text)) {
    return { query: { kind: 'type', type: 'flying' }, interpreted: 'Is it a Flying type?' };
  }
  return null;
};

const ruleGeneration: Rule = (text) => {
  const genOf = (token: string | undefined): number | null =>
    token === undefined ? null : (GENERATION_ALIASES[token] ?? null);

  // comparisons: "older than unova", "before gen 4", "after gen 4", "gen 4 or earlier/later"
  let match = /\b(?:older than|before|earlier than)(?: gen(?:eration)?)? ([a-z0-9]+)\b/.exec(text);
  let generation = genOf(match?.[1]);
  if (generation !== null) {
    return {
      query: { kind: 'generation', op: 'lt', generation },
      interpreted: `Was it introduced before Generation ${generation}?`,
    };
  }
  match = /\b(?:newer than|after|later than)(?: gen(?:eration)?)? ([a-z0-9]+)\b/.exec(text);
  generation = genOf(match?.[1]);
  if (generation !== null) {
    return {
      query: { kind: 'generation', op: 'gt', generation },
      interpreted: `Was it introduced after Generation ${generation}?`,
    };
  }
  match = /\bgen(?:eration)? ([a-z0-9]+) or (earlier|later|before|after|newer|older)\b/.exec(text);
  generation = genOf(match?.[1]);
  if (generation !== null && match?.[2] !== undefined) {
    const op: ComparisonOp = match[2] === 'later' || match[2] === 'after' || match[2] === 'newer' ? 'gte' : 'lte';
    return {
      query: { kind: 'generation', op, generation },
      interpreted: `Was it introduced in Generation ${generation} or ${op === 'gte' ? 'later' : 'earlier'}?`,
    };
  }
  // equality: "gen 4", "generation four", "introduced in sinnoh", "from sinnoh"
  match = /\bgen(?:eration)? ([a-z0-9]+)\b/.exec(text);
  generation = genOf(match?.[1]);
  if (generation !== null) {
    return {
      query: { kind: 'generation', op: 'eq', generation },
      interpreted: `Was it introduced in Generation ${generation}?`,
    };
  }
  match = /\b(?:from|introduced in|debut(?:ed)? in|native to|found in) (?:the )?([a-z]+)(?: region)?\b/.exec(text);
  generation = genOf(match?.[1]);
  if (generation !== null) {
    return {
      query: { kind: 'generation', op: 'eq', generation },
      interpreted: `Was it introduced in Generation ${generation}?`,
    };
  }
  // bare region name: "is it a sinnoh pokemon", "is it sinnoh"
  for (const region of ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'hisui', 'paldea']) {
    if (new RegExp(`\\b${region}\\b`).test(text)) {
      const generationForRegion = GENERATION_ALIASES[region];
      if (generationForRegion !== undefined) {
        return {
          query: { kind: 'generation', op: 'eq', generation: generationForRegion },
          interpreted: `Was it introduced in Generation ${generationForRegion}?`,
        };
      }
    }
  }
  return null;
};

const ruleCategory: Rule = (text) => {
  if (/\blegendary or mythical|mythical or legendary\b/.test(text)) {
    return { query: { kind: 'legendary-or-mythical' }, interpreted: 'Is it Legendary or Mythical?' };
  }
  if (/\blegendary\b/.test(text)) {
    return { query: { kind: 'legendary' }, interpreted: 'Is it a Legendary Pokémon?' };
  }
  if (/\bmythical\b/.test(text)) {
    return { query: { kind: 'mythical' }, interpreted: 'Is it a Mythical Pokémon?' };
  }
  if (/\bbaby\b/.test(text)) {
    return { query: { kind: 'baby' }, interpreted: 'Is it a baby Pokémon?' };
  }
  if (/\bstarter\b/.test(text)) {
    return {
      query: { kind: 'starter' },
      interpreted: 'Is it a starter Pokémon or one of its evolutions?',
    };
  }
  return null;
};

const ruleEvolution: Rule = (text, ctx) => {
  if (/\bfully evolved|final (?:evolution|form|stage)|last (?:evolution|form|stage)\b/.test(text)) {
    return { query: { kind: 'fully-evolved' }, interpreted: 'Is it fully evolved?' };
  }
  if (/\bmiddle (?:evolution|stage|form)|second stage\b/.test(text)) {
    return { query: { kind: 'middle-evolution' }, interpreted: 'Is it a middle evolution?' };
  }
  if (/\bfirst (?:stage|form)|basic pokemon|unevolved\b/.test(text)) {
    return {
      query: { kind: 'evolution-stage', stage: 1 },
      interpreted: 'Is it the first stage of its evolution line?',
    };
  }
  if (/\b(?:have|has|got) (?:a |an )?pre[\s-]?evolution\b/.test(text) || /\bevolved? from (?:something|another|a pokemon)\b/.test(text) || /\bis it evolved\b/.test(text)) {
    return { query: { kind: 'has-pre-evolution' }, interpreted: 'Did it evolve from another Pokémon?' };
  }
  if (/\bbranch(?:ing|es)?\b/.test(text) && /\bevolution|evolve\b/.test(text)) {
    return {
      query: { kind: 'branching-evolution' },
      interpreted: 'Does its evolution line branch?',
    };
  }
  const line = /\b(?:same (?:evolution(?:ary)? )?(?:line|family|chain) as|related to|in the family of) ([a-z0-9\s'.-]+)$/.exec(text);
  if (line?.[1] !== undefined) {
    const named = lookupPokemonName(line[1].trim(), ctx);
    if (named !== null) {
      return {
        query: { kind: 'in-evolution-line-of', pokemonId: named.id },
        interpreted: `Is it in the same evolution line as ${capitalize(named.matchedName)}?`,
      };
    }
  }
  if (/\b(?:can|does|will|able to) (?:it )?(?:still )?evolve\b/.test(text) || /\bevolve(?:s)? (?:further|again|more)\b/.test(text) || /\bcan it still evolve\b/.test(text)) {
    return { query: { kind: 'can-evolve' }, interpreted: 'Can it still evolve?' };
  }
  return null;
};

const ruleDimensions: Rule = (text) => {
  const heightCompare = new RegExp(
    String.raw`\b(taller|bigger|larger|longer|shorter|smaller) than (?:about |around )?${NUM} ?${HEIGHT_UNIT}\b`,
  ).exec(text);
  if (heightCompare?.[1] !== undefined && heightCompare[2] !== undefined && heightCompare[3] !== undefined) {
    const value = parseNumber(heightCompare[2]);
    if (value !== null) {
      const decimeters = Math.round(heightToDecimeters(value, heightCompare[3]) * 10) / 10;
      const op: ComparisonOp = heightCompare[1] === 'shorter' || heightCompare[1] === 'smaller' ? 'lt' : 'gt';
      return {
        query: { kind: 'height', op, decimeters },
        interpreted: `Is it ${op === 'gt' ? 'taller' : 'shorter'} than ${decimeters / 10} m?`,
      };
    }
  }
  const weightCompare = new RegExp(
    String.raw`\b(heavier|lighter) than (?:about |around )?${NUM} ?${WEIGHT_UNIT}\b`,
  ).exec(text);
  if (weightCompare?.[1] !== undefined && weightCompare[2] !== undefined && weightCompare[3] !== undefined) {
    const value = parseNumber(weightCompare[2]);
    if (value !== null) {
      const hectograms = Math.round(weightToHectograms(value, weightCompare[3]) * 10) / 10;
      const op: ComparisonOp = weightCompare[1] === 'lighter' ? 'lt' : 'gt';
      return {
        query: { kind: 'weight', op, hectograms },
        interpreted: `Is it ${op === 'gt' ? 'heavier' : 'lighter'} than ${hectograms / 10} kg?`,
      };
    }
  }
  // vague size words
  if (/\b(?:is it )?(?:really |very )?(?:tall|big|large|huge|giant)\b/.test(text)) {
    return {
      query: { kind: 'height', op: 'gt', decimeters: 15 },
      interpreted: 'Is it taller than 1.5 m?',
    };
  }
  if (/\b(?:is it )?(?:really |very )?(?:small|tiny|short|little)\b/.test(text)) {
    return {
      query: { kind: 'height', op: 'lte', decimeters: 5 },
      interpreted: 'Is it 50 cm tall or shorter?',
    };
  }
  if (/\bheavy\b/.test(text)) {
    return {
      query: { kind: 'weight', op: 'gt', hectograms: 1000 },
      interpreted: 'Is it heavier than 100 kg?',
    };
  }
  if (/\blight(?:weight)?\b/.test(text)) {
    return {
      query: { kind: 'weight', op: 'lte', hectograms: 100 },
      interpreted: 'Does it weigh 10 kg or less?',
    };
  }
  return null;
};

const ruleColor: Rule = (text) => {
  for (const color of COLOR_WORDS) {
    if (new RegExp(`\\b(?:mostly |mainly |primarily )?${color}\\b`).test(text)) {
      const canonical = color === 'grey' ? 'gray' : color;
      return {
        query: { kind: 'color', color: canonical },
        interpreted: `Is it mostly ${canonical}?`,
      };
    }
  }
  return null;
};

const ruleTraits: Rule = (text) => {
  for (const [pattern, trait] of TRAIT_PHRASES) {
    if (pattern.test(text)) {
      return {
        query: { kind: 'trait', trait },
        interpreted: `Trait check: ${trait.replaceAll('-', ' ')}?`,
      };
    }
  }
  return null;
};

const ruleHabitat: Rule = (text) => {
  const match = /\b(?:live|lives|found|dwell|dwells) (?:in|near|around|by) (?:the |a )?([a-z]+)\b/.exec(text);
  const habitat = match?.[1] !== undefined ? HABITAT_ALIASES[match[1]] : undefined;
  if (habitat !== undefined) {
    return {
      query: { kind: 'habitat', habitat },
      interpreted: `Does it live in the ${habitat.replaceAll('-', ' ')} habitat?`,
    };
  }
  return null;
};

const ruleGender: Rule = (text) => {
  if (/\bgenderless|no gender|without (?:a )?gender\b/.test(text)) {
    return { query: { kind: 'genderless' }, interpreted: 'Is it genderless?' };
  }
  let match = /\b(?:always|only|exclusively) (male|female)\b/.exec(text);
  if (match === null) {
    match = /\b(male|female)[\s-]only\b/.exec(text);
  }
  if (match?.[1] === 'male' || match?.[1] === 'female') {
    return {
      query: { kind: 'single-gender', gender: match[1] },
      interpreted: `Is it always ${match[1]}?`,
    };
  }
  return null;
};

const ruleAbility: Rule = (text) => {
  const match = /\b(?:have|has|got) (?:the )?ability ([a-z\s-]+)$/.exec(text);
  if (match?.[1] !== undefined) {
    const ability = match[1].trim().replaceAll(/\s+/g, '-');
    return {
      query: { kind: 'ability', ability },
      interpreted: `Can it have the ability ${match[1].trim()}?`,
    };
  }
  return null;
};

const ruleNameLetter: Rule = (text) => {
  const match = /\bname (start|starts|begin|begins|end|ends) with (?:the letter )?([a-z])\b/.exec(text);
  if (match?.[1] !== undefined && match[2] !== undefined) {
    const position = match[1].startsWith('end') ? 'ends' : 'starts';
    return {
      query: { kind: 'name-letter', letter: match[2], position },
      interpreted: `Does its name ${position === 'ends' ? 'end' : 'start'} with "${match[2]}"?`,
    };
  }
  const contains = /\bname (?:contain|contains|include|includes|has) (?:the letter )?([a-z])\b/.exec(text);
  if (contains?.[1] !== undefined) {
    return {
      query: { kind: 'name-letter', letter: contains[1], position: 'contains' },
      interpreted: `Does its name contain "${contains[1]}"?`,
    };
  }
  return null;
};

const ruleStatTotal: Rule = (text) => {
  const match = /\b(?:base stat total|bst|total stats?) (?:over|above|more than|greater than|of at least) (\d+)\b/.exec(text);
  if (match?.[1] !== undefined) {
    return {
      query: { kind: 'stat-total', op: 'gt', value: Number(match[1]) },
      interpreted: `Is its base stat total above ${match[1]}?`,
    };
  }
  if (/\b(?:strong|powerful)\b/.test(text)) {
    return {
      query: { kind: 'stat-total', op: 'gt', value: 500 },
      interpreted: 'Is it strong (base stat total above 500)?',
    };
  }
  if (/\bweak\b/.test(text)) {
    return {
      query: { kind: 'stat-total', op: 'lt', value: 350 },
      interpreted: 'Is it weak (base stat total below 350)?',
    };
  }
  return null;
};

/** Direct name guesses: "is it pikachu", "pikachu?", "my guess is pikachu". */
const ruleNameGuess: Rule = (text, ctx) => {
  const patterns = [
    /^(?:is it|it is|is it maybe|could it be|might it be|is the pokemon|are you|my guess is|i guess|i think it is) (?:a |an |the )?([a-z0-9\s'.-]+)$/,
    /^([a-z0-9'.-]+)$/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1] !== undefined) {
      const named = lookupPokemonName(match[1].trim(), ctx);
      if (named !== null) {
        return {
          query: { kind: 'name-guess', pokemonId: named.id },
          interpreted: `Is it ${capitalize(named.matchedName)}?`,
        };
      }
    }
  }
  return null;
};

// Order matters. Name guesses run first (exact vocabulary can't collide with
// them because type/region words are never Pokémon names), then multi-word
// concepts, then broad single-word rules.
const RULES: readonly Rule[] = [
  ruleNameGuess,
  ruleDualType,
  ruleType,
  ruleCategory,
  ruleEvolution,
  ruleGeneration,
  ruleDimensions,
  ruleNameLetter,
  ruleAbility,
  ruleGender,
  ruleHabitat,
  ruleTraits,
  ruleColor,
  ruleStatTotal,
];

export function parsePlayerQuestion(raw: string, ctx: ParserContext): ParseSuccess | null {
  let text = normalizeText(raw);
  if (text.length === 0) return null;

  // Negation: detect and strip so downstream rules see the positive form.
  let negated = false;
  if (/\bnot\b/.test(text) || /\bnever\b/.test(text)) {
    negated = true;
    text = text.replace(/\bnot\b/g, ' ').replace(/\bnever\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  for (const rule of RULES) {
    const result = rule(text, ctx);
    if (result !== null) {
      const effectiveNegated = result.flipNegation === true ? !negated : negated;
      return {
        question: { query: result.query, negated: effectiveNegated },
        interpreted: negated ? `${result.interpreted} (negated)` : result.interpreted,
      };
    }
  }
  return null;
}
