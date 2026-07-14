import { Hono } from 'hono';
import type { AppEnv } from './env';

const app = new Hono<AppEnv>();

app.get('/api/health', (c) =>
  c.json({ ok: true, name: c.env.APP_NAME, time: new Date().toISOString() }),
);

// All non-/api requests fall through to Workers Static Assets (SPA handling
// is configured in wrangler.jsonc via not_found_handling).
export default app;
