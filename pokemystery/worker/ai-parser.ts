/**
 * Optional Stage 2 parser: Workers AI translates a player question into a
 * StructuredQuery when the deterministic parser fails. The model NEVER
 * answers Pokémon questions — its output is schema-validated and then
 * evaluated by the same deterministic engine as everything else.
 */

import { z } from 'zod';
import { structuredQuerySchema, type ParsedQuestion } from '../shared/query';
import { describeQuery } from '../shared/parser/describe';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/** Kinds the AI may produce. Identifier-bearing kinds are deterministic-only. */
const AI_FORBIDDEN_KINDS = new Set(['name-guess', 'in-evolution-line-of']);

const aiOutputSchema = z.object({
  kind: z.string(),
  negated: z.boolean().optional(),
});

const SYSTEM_PROMPT = `You translate a player's question about a hidden Pokémon into ONE JSON object. Output ONLY the JSON object, nothing else.
Allowed shapes (pick exactly one):
{"kind":"type","type":"<one of: normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel fairy>"}
{"kind":"dual-type"}
{"kind":"generation","op":"<eq|lt|lte|gt|gte>","generation":<1-9>}
{"kind":"legendary"} {"kind":"mythical"} {"kind":"legendary-or-mythical"} {"kind":"baby"} {"kind":"starter"}
{"kind":"can-evolve"} {"kind":"fully-evolved"} {"kind":"has-pre-evolution"} {"kind":"middle-evolution"} {"kind":"branching-evolution"} {"kind":"evolution-stage","stage":<1-3>}
{"kind":"height","op":"<gt|lt|gte|lte>","decimeters":<number>}
{"kind":"weight","op":"<gt|lt|gte|lte>","hectograms":<number>}
{"kind":"stat-total","op":"<gt|lt|gte|lte>","value":<number>}
{"kind":"color","color":"<red|blue|yellow|green|pink|purple|brown|black|white|gray>"}
{"kind":"habitat","habitat":"<cave|forest|grassland|mountain|rare|rough-terrain|sea|urban|waters-edge>"}
{"kind":"trait","trait":"<four-legged|bipedal|has-wings|serpentine|fish-like|humanoid|has-arms|round-body|insectoid|has-tentacles|dragon-like|bird-like|feline|canine|rodent-like|mechanical|object-like|plant-like|cute|intimidating>"}
{"kind":"egg-group","eggGroup":"<slug>"} {"kind":"ability","ability":"<slug>"}
{"kind":"genderless"} {"kind":"single-gender","gender":"<male|female>"}
{"kind":"name-letter","letter":"<a-z>","position":"<starts|contains|ends>"}
Add "negated":true INSIDE the object if the question is negative ("is it not...").
If the question cannot be expressed with these shapes, output exactly: {"kind":"unknown"}`;

interface AiTextResponse {
  response?: string;
}

export async function aiParseQuestion(
  ai: Ai,
  model: string | undefined,
  text: string,
): Promise<{ question: ParsedQuestion; interpreted: string } | null> {
  let raw: string;
  try {
    const result = (await ai.run(model ?? DEFAULT_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 200) },
      ],
      max_tokens: 100,
      temperature: 0,
    })) as AiTextResponse;
    raw = result.response ?? '';
  } catch (error) {
    console.error('workers-ai parse failed:', String(error));
    return null;
  }

  const jsonMatch = /\{[\s\S]*\}/.exec(raw);
  if (jsonMatch === null) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  const envelope = aiOutputSchema.safeParse(parsedJson);
  if (!envelope.success || envelope.data.kind === 'unknown' || AI_FORBIDDEN_KINDS.has(envelope.data.kind)) {
    return null;
  }
  const query = structuredQuerySchema.safeParse(parsedJson);
  if (!query.success) return null;

  const negated = envelope.data.negated === true;
  return {
    question: { query: query.data, negated },
    interpreted: describeQuery(query.data, negated),
  };
}
