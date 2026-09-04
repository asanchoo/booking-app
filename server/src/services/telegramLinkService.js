import crypto from 'crypto';
import { database } from '../db/database.js';
import { normalizePhone } from '../utils/phone.js';

export async function createTelegramLink(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) throw new Error('Некорректный номер телефона');
  const existing = await database.one('SELECT chat_id FROM telegram_links WHERE phone = ?', [cleanPhone]);
  if (existing?.chat_id) return { linked: true, link: null };

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'barbershop_astanabot';
  const code = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await database.run(`
    INSERT INTO telegram_linking_codes (code, phone, expires_at) VALUES (?, ?, ?)
    ON CONFLICT (code) DO UPDATE SET phone = excluded.phone, expires_at = excluded.expires_at
  `, [code, cleanPhone, expiresAt]);
  return { linked: false, link: `https://t.me/${botUsername}?start=${code}` };
}
