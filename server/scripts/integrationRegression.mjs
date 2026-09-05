import assert from 'node:assert/strict';
import { checkAndSendReminders } from '../src/services/reminderService.js';
import { telegramState } from '../src/services/telegramStateService.js';
import { processTelegramUpdate } from '../src/services/telegramService.js';
import { formatDateTime } from '../src/utils/datetime.js';

// Called only from regression.mjs against its disposable local database.
export async function integrationRegression({ database, bookingId, phone }) {
  const now = new Date();
  const chatId = 999000001;
  await database.run('INSERT INTO telegram_links (phone, chat_id) VALUES (?, ?)', [phone, chatId]);
  const shift = minutes => formatDateTime(new Date(now.getTime() + minutes * 60_000));
  await database.run("UPDATE bookings SET status = 'confirmed', attendance_status = 'pending', starts_at = ?, ends_at = ?, reminder_3h_sent = 0, reminder_1h_sent = 0 WHERE id = ?", [shift(140), shift(170), bookingId]);
  const failed = await checkAndSendReminders({ now, send: async () => { throw new Error('Simulated Telegram outage'); } });
  assert.equal(failed.failures, 1);
  assert.equal((await database.one('SELECT reminder_3h_sent FROM bookings WHERE id = ?', [bookingId])).reminder_3h_sent, 0);
  const messages = [];
  const send = async (id, text, options) => { messages.push({ id, text, options }); };
  assert.equal((await checkAndSendReminders({ now, send })).reminders3h, 1);
  assert.equal((await checkAndSendReminders({ now, send })).reminders3h, 0);
  await database.run('UPDATE bookings SET starts_at = ?, ends_at = ? WHERE id = ?', [shift(40), shift(70), bookingId]);
  assert.equal((await checkAndSendReminders({ now, send })).reminders1h, 1);
  assert.ok(messages[1].options.reply_markup.inline_keyboard.length);
  await database.run("UPDATE bookings SET starts_at = ?, ends_at = ?, attendance_status = 'attended' WHERE id = ?", [shift(-60), shift(-30), bookingId]);
  assert.equal((await checkAndSendReminders({ now, send })).reviewRequests, 1);
  assert.equal((await checkAndSendReminders({ now, send })).reviewRequests, 0);
  assert.equal(messages.length, 3);
  await database.run("INSERT INTO scheduled_job_leases (name, owner, expires_at) VALUES ('reminders', 'another-worker', ?)", [new Date(Date.now() + 60_000).toISOString()]);
  assert.equal((await checkAndSendReminders({ now, send })).skipped, true);
  await database.run("DELETE FROM scheduled_job_leases WHERE name = 'reminders' AND owner = 'another-worker'");

  await telegramState('test').set('choice', { slot: shift(140) });
  assert.deepEqual(await telegramState('test').get('choice'), { slot: shift(140) });
  await database.run("UPDATE telegram_flow_states SET expires_at = '2000-01-01' WHERE key = 'test:choice'");
  assert.equal(await telegramState('test').get('choice'), null);

  process.env.TELEGRAM_MODE = 'webhook';
  process.env.TELEGRAM_BOT_TOKEN = '123456:regression-only-not-a-real-token';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(String(url).startsWith('https://api.telegram.org/bot123456:regression-only-not-a-real-token/'));
    return Response.json({ ok: true, result: { message_id: 1, chat: { id: chatId, type: 'private' }, text: 'Test' } });
  };
  try {
    await processTelegramUpdate({ update_id: 900 }); // Exercises actual installed SDK dispatcher.
    await processTelegramUpdate({ update_id: 901, callback_query: {
      id: 'test-callback', from: { id: chatId, is_bot: false, first_name: 'Test' }, chat_instance: 'test',
      message: { message_id: 1, chat: { id: chatId, type: 'private' } }, data: `review_rate_${bookingId}_5`,
    } });
    assert.ok(await telegramState('review').get(chatId));
    await processTelegramUpdate({ update_id: 902, message: {
      message_id: 2, date: Math.floor(Date.now() / 1000), chat: { id: chatId, type: 'private' },
      from: { id: chatId, is_bot: false, first_name: 'Test' }, text: 'Отзыв из Telegram',
    } });
    const review = await database.one('SELECT rating, comment, source FROM barber_reviews WHERE booking_id = ?', [bookingId]);
    assert.deepEqual(review, { rating: 5, comment: 'Отзыв из Telegram', source: 'telegram' });
    assert.equal(await telegramState('review').get(chatId), null);
  } finally { globalThis.fetch = originalFetch; }
  console.log('PASS: reminders retry, deduplication, review requests, worker lease, persistent state, webhook rating and comment (Telegram transport mocked).');
}
