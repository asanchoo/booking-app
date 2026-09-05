import { database } from '../db/database.js';

// Telegram updates may be processed by different serverless instances.
export function telegramState(namespace) {
  const keyFor = id => `${namespace}:${id}`;
  return {
    async get(id) {
      const row = await database.one('SELECT payload FROM telegram_flow_states WHERE key = ? AND expires_at > ?', [keyFor(id), new Date().toISOString()]);
      return row ? JSON.parse(row.payload) : null;
    },
    async set(id, value) {
      const now = new Date().toISOString();
      await database.run('DELETE FROM telegram_flow_states WHERE expires_at <= ?', [now]);
      await database.run(`INSERT INTO telegram_flow_states (key, payload, expires_at) VALUES (?, ?, ?)
        ON CONFLICT (key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at`,
      [keyFor(id), JSON.stringify(value), new Date(Date.now() + 30 * 60 * 1000).toISOString()]);
    },
    async delete(id) { await database.run('DELETE FROM telegram_flow_states WHERE key = ?', [keyFor(id)]); },
  };
}
