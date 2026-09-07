import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAndSendReminders } from '../src/services/reminderService.js';
import { parseDateTimeInZone } from '../src/utils/datetime.js';

function reminderDb(booking) {
  const updates = [];
  return {
    updates,
    async one(sql) {
      if (sql.includes('scheduled_job_leases')) return { owner: 'test-owner' };
      if (sql.includes('telegram_links')) return { chat_id: 12345 };
      return null;
    },
    async all(sql) {
      if (sql.includes('reminder_3h_sent')) return [booking];
      if (sql.includes('review_request_sent_at')) return [];
      return [];
    },
    async run(sql, params) {
      updates.push({ sql, params });
      return { changes: 1 };
    },
  };
}

test('salon-local booking time is converted to the correct instant', () => {
  const instant = parseDateTimeInZone('2026-09-07T09:00:00', 'Asia/Almaty');
  assert.equal(instant.toISOString(), '2026-09-07T04:00:00.000Z');
});

test('sends the three-hour reminder three hours before salon-local start', async () => {
  const db = reminderDb({
    id: 71,
    client_phone: '+77000000000',
    starts_at: '2026-09-07T09:00:00',
    reminder_3h_sent: 0,
    reminder_1h_sent: 1,
    service_name: 'Стрижка',
    barber_name: 'Асанали',
  });
  const messages = [];

  const stats = await checkAndSendReminders({
    db,
    now: new Date('2026-09-07T01:00:00.000Z'),
    send: async (...args) => messages.push(args),
  });

  assert.equal(stats.reminders3h, 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0][1], /09:00/);
  assert.equal(db.updates.some(({ sql }) => sql.includes('reminder_3h_sent = 1')), true);
});

test('does not send a reminder after the salon-local visit has passed', async () => {
  const db = reminderDb({
    id: 72,
    client_phone: '+77000000000',
    starts_at: '2026-09-07T09:00:00',
    reminder_3h_sent: 0,
    reminder_1h_sent: 0,
    service_name: 'Стрижка',
    barber_name: 'Асанали',
  });
  const messages = [];

  const stats = await checkAndSendReminders({
    db,
    now: new Date('2026-09-07T07:22:00.000Z'),
    send: async (...args) => messages.push(args),
  });

  assert.equal(stats.reminders3h, 0);
  assert.equal(stats.reminders1h, 0);
  assert.equal(messages.length, 0);
});

