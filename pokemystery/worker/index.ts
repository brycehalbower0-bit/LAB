import { Hono } from 'hono';
import type { AppEnv } from './env';
import { games } from './routes/games';
import { misc } from './routes/misc';

const app = new Hono<AppEnv>();

app.get('/api/health', (c) =>
  c.json({ ok: true, name: c.env.APP_NAME, time: new Date().toISOString() }),
);

app.route('/api/games', games);
app.route('/api', misc);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'not-found' }, 404);
  }
  // Non-API paths fall through to Workers Static Assets (SPA handling is
  // configured in wrangler.jsonc). Reaching here means assets didn't match.
  return c.text('Not found', 404);
});

app.onError((error, c) => {
  console.error('unhandled error:', error);
  return c.json({ error: 'internal', detail: 'Something went wrong.' }, 500);
});

export default app;
