import crypto from 'crypto';
import { db } from '../db/connection.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createTelegramLoginLink(chatId) {
  const telegramLink = db.prepare('SELECT phone FROM telegram_links WHERE chat_id = ?').get(chatId);
  if (!telegramLink) throw new HttpError(401, 'Telegram не привязан к номеру телефона');
  const phone = normalizePhone(telegramLink.phone);
  const client = db.prepare('SELECT id FROM clients WHERE phone = ?').get(phone);
  if (!client) throw new HttpError(404, 'Сначала создайте личный кабинет на сайте');

  db.prepare('DELETE FROM telegram_login_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(new Date().toISOString());
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO telegram_login_tokens (token_hash, phone, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), phone, expiresAt);
  const baseUrl = String(process.env.PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  return `${baseUrl}/api/client-auth/telegram-login?token=${encodeURIComponent(token)}`;
}

export function consumeTelegramLoginToken(token) {
  const value = String(token || '');
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(value)) throw new HttpError(400, 'Некорректная ссылка входа');
  const now = new Date().toISOString();
  return db.transaction(() => {
    const record = db.prepare(`
      SELECT token_hash AS tokenHash, phone FROM telegram_login_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(hashToken(value), now);
    if (!record) throw new HttpError(400, 'Ссылка входа недействительна или истекла');
    const used = db.prepare('UPDATE telegram_login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL')
      .run(now, record.tokenHash);
    if (used.changes !== 1) throw new HttpError(400, 'Ссылка входа уже использована');
    const client = db.prepare('SELECT phone, name FROM clients WHERE phone = ?').get(record.phone);
    if (!client) throw new HttpError(404, 'Клиентский аккаунт не найден');
    return client;
  })();
}
