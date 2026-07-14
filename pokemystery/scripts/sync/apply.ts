/**
 * Apply generated SQL batches to D1 via wrangler, then record the import in
 * import_runs.
 *
 *   tsx scripts/sync/apply.ts --local            # local dev database
 *   tsx scripts/sync/apply.ts --remote           # production database (needs wrangler auth)
 *   tsx scripts/sync/apply.ts --local --fixture  # after build-sql --fixture
 *
 * Remote note: `wrangler d1 execute --remote --file` is the supported way to
 * run bulk statements against a production D1 database; there is no direct
 * connection string. Ensure `wrangler login` (or CLOUDFLARE_API_TOKEN) and a
 * real database_id in wrangler.jsonc before running --remote.
 */

import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.join(import.meta.dirname, '..', '..');
const SQL_DIR = path.join(ROOT, 'data', 'generated-sql');

function runWrangler(args: string[]): void {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 600_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `wrangler ${args.join(' ')} failed (exit ${String(result.status)}):\n${result.stderr || result.stdout}`,
    );
  }
}

async function main(): Promise<void> {
  const remote = process.argv.includes('--remote');
  const local = process.argv.includes('--local');
  if (remote === local) {
    throw new Error('Pass exactly one of --local or --remote');
  }
  const target = remote ? '--remote' : '--local';

  const meta = JSON.parse(await readFile(path.join(SQL_DIR, 'meta.json'), 'utf8')) as {
    source: string;
    importedAt: string;
    rangeStart: number;
    rangeEnd: number;
    count: number;
  };

  const files = (await readdir(SQL_DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('No SQL files found — run build-sql first.');

  console.log(`Applying ${files.length} SQL batches to D1 (${target})...`);
  const startedAt = new Date().toISOString();
  try {
    for (const file of files) {
      console.log(`  ${file}`);
      runWrangler(['d1', 'execute', 'pokemystery-db', target, '--file', path.join(SQL_DIR, file), '-y']);
    }
    const finishRun = `INSERT INTO import_runs (source, range_start, range_end, record_count, status, started_at, finished_at)
      VALUES ('${meta.source}', ${meta.rangeStart}, ${meta.rangeEnd}, ${meta.count}, 'complete', '${startedAt}', '${new Date().toISOString()}');`;
    runWrangler(['d1', 'execute', 'pokemystery-db', target, '--command', finishRun, '-y']);
    console.log(`Import complete: ${meta.count} records (${meta.source}).`);
  } catch (error) {
    const failRun = `INSERT INTO import_runs (source, range_start, range_end, record_count, status, error, started_at, finished_at)
      VALUES ('${meta.source}', ${meta.rangeStart}, ${meta.rangeEnd}, 0, 'failed', ${sqlString(String(error))}, '${startedAt}', '${new Date().toISOString()}');`;
    try {
      runWrangler(['d1', 'execute', 'pokemystery-db', target, '--command', failRun, '-y']);
    } catch {
      // best effort — surface the original failure
    }
    throw error;
  }
}

function sqlString(value: string): string {
  return `'${value.slice(0, 1000).replaceAll("'", "''")}'`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
