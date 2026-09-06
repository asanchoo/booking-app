// Run only against a disposable local PostgreSQL database populated by db:setup.
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.endsWith('_regression'), 'Use a disposable local *_regression database');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.ADMIN_USERNAME = 'regression-admin';
process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('RegressionPassword42', 4);
process.env.AI_PROVIDER = 'demo';
delete process.env.TELEGRAM_BOT_TOKEN;
const { default: app } = await import('../src/app.js');
const { database, closeDatabase } = await import('../src/db/database.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let checks = 0;
async function request(route, { method = 'GET', data, cookie, status = 200 } = {}) {
  const response = await fetch(base + '/api' + route, {
    method, headers: { Origin: base, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(body)}`);
  checks++;
  return { body, cookie: response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
}
try {
  await request('/health');
  for (const route of ['/bookings', '/admin/services', '/admin/barbers', '/admin/settings', '/admin/reviews', '/barber/me', '/my-bookings']) await request(route, { status: 401 });
  await request('/auth/login', { method: 'POST', data: { login: {}, password: [] }, status: 401 });
  const { cookie: admin } = await request('/auth/login', { method: 'POST', data: { login: process.env.ADMIN_USERNAME, password: 'RegressionPassword42' } });
  assert.ok(admin.includes('admin_token='));
  for (const route of ['/auth/me', '/bookings', '/admin/services', '/admin/barbers', '/admin/barbers/time-blocks', '/admin/settings', '/admin/reviews']) await request(route, { cookie: admin });
  await request('/admin/services', { method: 'POST', cookie: admin, data: {}, status: 400 });
  await request('/admin/settings', { method: 'PUT', cookie: admin, data: { workStart: '09:00', workEnd: '18:00', slotStepMinutes: 0, workDays: '1,2' }, status: 400 });
  const { body: master } = await request('/admin/barbers', { method: 'POST', cookie: admin, status: 201, data: { name: 'Regression master', specialty: 'Парикмахер' } });
  assert.equal(master.specialty, 'Парикмахер');
  await request(`/admin/barbers/${master.id}/account`, { method: 'POST', cookie: admin, status: 201, data: { username: 'regression-master', password: 'RegressionPassword42' } });
  const { body: service } = await request('/admin/services', { method: 'POST', cookie: admin, status: 201, data: { name: 'Regression service', description: 'Test', durationMinutes: 30, priceCents: 1000, masterIds: [master.id] } });
  const { body: masters } = await request(`/barbers?serviceId=${service.id}`);
  assert.deepEqual(masters.map(v => v.id), [master.id]);
  const phone = '70000009991';
  await request('/client-auth/register', { method: 'POST', data: { phone, name: 'Regression client', password: 'RegressionPassword42' }, status: 201 });
  await request('/client-auth/register', { method: 'POST', data: { phone, name: 'Regression client', password: 'RegressionPassword42' }, status: 409 });
  await request('/client-auth/register', { method: 'POST', data: { phone: '70000009992', name: 'Regression client', password: {} }, status: 400 });
  const { cookie: client } = await request('/auth/login', { method: 'POST', data: { login: phone, password: 'RegressionPassword42' } });
  const { cookie: barber } = await request('/auth/login', { method: 'POST', data: { login: 'regression-master', password: 'RegressionPassword42' } });
  for (const route of ['/barber/me', '/barber/bookings', '/barber/reviews', '/barber/time-blocks']) await request(route, { cookie: barber });
  await request('/admin/services', { cookie: client, status: 401 });
  await request('/admin/services', { cookie: barber, status: 401 });
  await request('/client-auth/telegram/status', { cookie: client });
  const { body: times } = await request(`/slots?serviceId=${service.id}&barberId=${master.id}`);
  const slots = times.slots.filter(s => new Date(s.startsAt).getTime() > Date.now() + 2 * 86400000);
  assert.ok(slots.length > 3);
  const payload = { serviceId: service.id, barberId: master.id, startsAt: slots[0].startsAt, clientName: 'Regression client', clientPhone: phone };
  await request('/bookings', { method: 'POST', data: { ...payload, clientName: {} }, status: 400 });
  await request('/bookings', { method: 'POST', data: { ...payload, startsAt: slots[0].startsAt.slice(0, 11) + '23:30:00' }, status: 409 });
  await request(`/slots?serviceId=${service.id}&barberId=${master.id}&from=2026-01-01&to=2099-01-01`, { status: 400 });
  const { body: booking } = await request('/bookings', { method: 'POST', data: payload, status: 201 });
  await request('/bookings', { method: 'POST', data: payload, status: 409 });
  assert.ok((await request('/my-bookings', { cookie: client })).body.some(b => b.id === booking.id));
  assert.ok((await request('/barber/bookings', { cookie: barber })).body.some(b => b.id === booking.id));
  await request(`/bookings/${booking.id}/reschedule`, { method: 'POST', cookie: client, data: { newStartsAt: slots[1].startsAt } });
  await request(`/my-bookings/${booking.id}/review`, { method: 'POST', cookie: client, data: { rating: 5 }, status: 400 });
  await request(`/barber/clients/${phone}/note`, { method: 'PUT', cookie: barber, data: { note: 'Test note' } });
  await request(`/my-bookings/${booking.id}/cancel`, { method: 'POST', cookie: client });
  const { body: block } = await request('/barber/time-blocks', { method: 'POST', cookie: barber, status: 201, data: { ...slots[2], reason: 'Test break' } });
  await request('/bookings', { method: 'POST', data: { ...payload, startsAt: slots[2].startsAt }, status: 409 });
  await request(`/barber/time-blocks/${block.id}`, { method: 'DELETE', cookie: barber });
  await request('/ai/chat', { method: 'POST', data: { messages: [{ role: 'user', content: 'Какие услуги есть?' }] } });
  await request('/ai/book', { method: 'POST', data: { ...payload, masterId: master.id, confirmed: false }, status: 400 });
  const { body: aiBooking } = await request('/ai/book', { method: 'POST', status: 201, data: { ...payload, masterId: master.id, confirmed: true } });
  assert.ok(aiBooking.telegram.link.startsWith('https://t.me/'));
  await request(`/my-bookings/${aiBooking.id}/cancel`, { method: 'POST', cookie: client });
  // Prepare a completed visit only in this disposable database to exercise reviews.
  await database.run("UPDATE bookings SET status = 'confirmed', attendance_status = 'attended' WHERE id = ?", [booking.id]);
  await request(`/my-bookings/${booking.id}/review`, { method: 'POST', cookie: client, status: 201, data: { rating: 5, comment: 'Test review' } });
  await request(`/my-bookings/${booking.id}/review`, { method: 'POST', cookie: client, status: 409, data: { rating: 5 } });
  for (const route of ['/admin/reviews', '/admin/barbers']) await request(route, { cookie: admin });
  await request('/barber/reviews', { cookie: barber });
  const concurrent = await Promise.all([201, 409].map(() => fetch(base + '/api/bookings', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, startsAt: slots[3].startsAt }) })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  checks += 2;
  await request(`/admin/services/${service.id}`, { method: 'DELETE', cookie: admin });
  await request('/auth/logout', { method: 'POST', cookie: client });
  const { integrationRegression } = await import('./integrationRegression.mjs');
  await integrationRegression({ database, bookingId: aiBooking.id, phone });
  console.log(`PASS: ${checks} HTTP checks against PostgreSQL (roles, catalog, bookings, reschedule, cancel, breaks, reviews, AI, Telegram link).`);
} finally {
  await new Promise(resolve => server.close(resolve));
  await closeDatabase();
}
