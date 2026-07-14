/** Meta, name suggestions, and correction reports. */

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadDataset } from '../db';
import { correctionReportSchema, pokemonNameQuerySchema } from '../../shared/schemas';
import type { MetaResponse, PokemonNameSuggestion } from '../../shared/api';

export const misc = new Hono<AppEnv>();

misc.get('/meta', async (c) => {
  const dataset = await loadDataset(c.env.DB);
  const generations = new Map<number, number>();
  for (const candidate of dataset.candidates) {
    const generation = candidate.record.generation;
    generations.set(generation, (generations.get(generation) ?? 0) + 1);
  }
  const response: MetaResponse = {
    appName: c.env.APP_NAME,
    pokemonCount: dataset.candidates.length,
    generations: [...generations.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([generation, count]) => ({ generation, count })),
    datasetImportedAt: dataset.importedAt,
    aiParserEnabled: c.env.AI_PARSER_ENABLED === 'true',
  };
  return c.json(response);
});

misc.get('/pokemon/names', async (c) => {
  const parsed = pokemonNameQuerySchema.safeParse({ q: c.req.query('q') ?? '' });
  if (!parsed.success) return c.json({ error: 'invalid-query' }, 400);
  const query = parsed.data.q.toLowerCase();

  const dataset = await loadDataset(c.env.DB);
  const suggestions: PokemonNameSuggestion[] = [];
  // Prefix matches first, then substring matches.
  for (const pass of ['prefix', 'substring'] as const) {
    for (const candidate of dataset.candidates) {
      if (suggestions.length >= 10) break;
      const name = candidate.record.displayName.toLowerCase();
      const hit = pass === 'prefix' ? name.startsWith(query) : name.includes(query);
      if (hit && !suggestions.some((s) => s.id === candidate.record.id)) {
        suggestions.push({ id: candidate.record.id, displayName: candidate.record.displayName });
      }
    }
    if (suggestions.length >= 10) break;
  }
  return c.json({ suggestions });
});

misc.post('/reports', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid-json' }, 400);
  }
  const parsed = correctionReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid-request', detail: parsed.error.issues[0]?.message }, 400);
  }
  const report = parsed.data;
  // Reports are stored for review; they never mutate canonical data directly.
  await c.env.DB.prepare(
    `INSERT INTO correction_reports (session_id, pokemon_id, category, detail)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(report.sessionId ?? null, report.pokemonId ?? null, report.category, report.detail ?? null)
    .run();
  return c.json({ ok: true });
});
