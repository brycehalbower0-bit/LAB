/**
 * Data sources for the sync pipeline.
 *
 * Two interchangeable sources serve identical JSON payloads:
 *  - `api`:    the live PokéAPI (https://pokeapi.co/api/v2) — production default.
 *  - `mirror`: the official PokéAPI static data repo (PokeAPI/api-data on
 *              GitHub), maintained by the PokéAPI team. Useful behind
 *              restrictive proxies and to avoid load on the live API.
 *
 * Every successful response is cached under data/cache/, which makes reruns
 * cheap, makes interrupted imports resumable, and avoids duplicate requests.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SourceName = 'api' | 'mirror';

const BASES: Record<SourceName, (resource: string, id: number) => string> = {
  api: (resource, id) => `https://pokeapi.co/api/v2/${resource}/${id}/`,
  mirror: (resource, id) =>
    `https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2/${resource}/${id}/index.json`,
};

export interface FetchStats {
  fromCache: number;
  fromNetwork: number;
  failures: number;
}

export class PokeApiSource {
  readonly name: SourceName;
  readonly stats: FetchStats = { fromCache: 0, fromNetwork: 0, failures: 0 };
  private readonly cacheDir: string;

  constructor(name: SourceName, cacheDir: string) {
    this.name = name;
    this.cacheDir = cacheDir;
  }

  /** Fetch `resource/id` (e.g. "pokemon-species", 25) with cache + retry. */
  async getJson<T>(resource: string, id: number): Promise<T> {
    const cachePath = path.join(this.cacheDir, resource, `${id}.json`);
    try {
      const cached = await readFile(cachePath, 'utf8');
      this.stats.fromCache += 1;
      return JSON.parse(cached) as T;
    } catch {
      // cache miss — fall through to network
    }

    const url = BASES[this.name](resource, id);
    const body = await fetchWithRetry(url);
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, body, 'utf8');
    this.stats.fromNetwork += 1;
    return JSON.parse(body) as T;
  }
}

const RETRY_DELAYS_MS = [1000, 3000, 8000, 15000];

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'pokemystery-sync (unofficial fan project)' },
      });
      if (response.status === 404) {
        throw new NotFoundError(url);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      console.warn(`  retry ${attempt + 1} for ${url} in ${delay}ms: ${String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${RETRY_DELAYS_MS.length + 1} attempts: ${String(lastError)}`);
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`404 Not Found: ${url}`);
    this.name = 'NotFoundError';
  }
}

/** Run `tasks` with bounded concurrency, preserving order of results. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined && index >= items.length) break;
      results[index] = await task(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}
