import crypto from 'crypto';
import { db } from '../db/connection.js';
import { normalizePhone } from '../utils/phone.js';

export function createTelegramLink(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) throw new Error('Некорректный номер телефона');
  const existing = db.prepare('SELECT chat_id FROM telegram_links WHERE phone = ?').get(cleanPhone);
  if (existing?.chat_id) return { linked: true, link: null };

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'barbershop_astanabot';
  const code = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('INSERT OR REPLACE INTO telegram_linking_codes (code, phone, expires_at) VALUES (?, ?, ?)')
    .run(code, cleanPhone, expiresAt);
  return { linked: false, link: `https://t.me/${botUsername}?start=${code}` };
}
