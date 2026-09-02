import { db } from '../db/connection.js';
import { normalizePhone } from '../utils/phone.js';

export function ensureClientRating(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  db.prepare('INSERT OR IGNORE INTO client_ratings (phone) VALUES (?)').run(phone);
  return phone;
}

export function applyClientRatingEvent({ phone: rawPhone, bookingId, eventType, delta }) {
  const phone = ensureClientRating(rawPhone);
  if (!phone) return { applied: false, rating: null };

  return db.transaction(() => {
    const event = db.prepare(`
      INSERT OR IGNORE INTO client_rating_events (phone, booking_id, event_type, delta)
      VALUES (?, ?, ?, ?)
    `).run(phone, bookingId ?? null, eventType, delta);

    if (event.changes > 0) {
      db.prepare(`
        UPDATE client_ratings
        SET rating = MIN(5, MAX(1, rating + ?)), updated_at = datetime('now')
        WHERE phone = ?
      `).run(delta, phone);
    }

    const rating = db.prepare('SELECT rating FROM client_ratings WHERE phone = ?').get(phone)?.rating ?? 5;
    return { applied: event.changes > 0, rating };
  })();
}
