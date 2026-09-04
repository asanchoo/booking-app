import { database, transaction } from '../db/database.js';
import { normalizePhone } from '../utils/phone.js';

export async function ensureClientRating(rawPhone, client = database) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  await client.run('INSERT INTO client_ratings (phone) VALUES (?) ON CONFLICT (phone) DO NOTHING', [phone]);
  return phone;
}

export async function applyClientRatingEvent({ phone: rawPhone, bookingId, eventType, delta }) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { applied: false, rating: null };

  return transaction(async (client) => {
    await ensureClientRating(phone, client);
    const event = await client.run(`
      INSERT INTO client_rating_events (phone, booking_id, event_type, delta)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (booking_id, event_type) DO NOTHING
    `, [phone, bookingId ?? null, eventType, delta]);

    if (event.changes > 0) {
      const current = Number((await client.one('SELECT rating FROM client_ratings WHERE phone = ?', [phone]))?.rating ?? 5);
      const next = Math.min(5, Math.max(1, current + Number(delta)));
      await client.run('UPDATE client_ratings SET rating = ?, updated_at = ? WHERE phone = ?', [next, new Date().toISOString(), phone]);
    }

    const rating = Number((await client.one('SELECT rating FROM client_ratings WHERE phone = ?', [phone]))?.rating ?? 5);
    return { applied: event.changes > 0, rating };
  });
}
