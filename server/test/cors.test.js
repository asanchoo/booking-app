import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../src/middleware/corsOptions.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { securityHeaders } from '../src/middleware/securityHeaders.js';

test('browser POST and preflight work on the application origin; foreign origins are rejected', async (t) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors(corsOptions));
  app.post('/api/auth/login', (req, res) => res.status(401).json({ error: 'Invalid credentials' }));
  app.post('/api/bookings', (req, res) => res.status(400).json({ error: 'Invalid booking' }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [route, status] of [['auth/login', 401], ['bookings', 400]]) {
    const response = await fetch(`${base}/api/${route}`, { method: 'POST', headers: { Origin: base } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), base);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
  }
  const preflight = await fetch(`${base}/api/bookings`, { method: 'OPTIONS', headers: { Origin: base, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204);
  for (const origin of ['https://foreign.vercel.app', 'null', `${base}.evil.example`]) {
    const response = await fetch(`${base}/api/bookings`, { method: 'POST', headers: { Origin: origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
});
