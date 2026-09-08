import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { rateLimit } from '../src/middleware/rateLimit.js';

test('rate limits are shared through the database and return Retry-After', async (t) => {
  const app = express();
  app.get('/limited', rateLimit({
    windowMs: 60_000,
    max: 2,
    keyGenerator: (req) => req.get('X-Test-Key'),
  }), (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const url = `http://127.0.0.1:${server.address().port}/limited`;
  const headers = { 'X-Test-Key': crypto.randomUUID() };
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal((await fetch(url, { headers })).status, 200);
  const limited = await fetch(url, { headers });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
