import crypto from 'crypto';
import { database, transaction } from '../db/database.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createTelegramLoginLink(chatId) {
  const telegramLink = await database.one('SELECT phone FROM telegram_links WHERE chat_id = ?', [chatId]);
  if (!telegramLink) throw new HttpError(401, 'Telegram не привязан к номеру телефона');
  const phone = normalizePhone(telegramLink.phone);
  const client = await database.one('SELECT id FROM clients WHERE phone = ?', [phone]);
  if (!client) throw new HttpError(404, 'Сначала создайте личный кабинет на сайте');

  await database.run('DELETE FROM telegram_login_tokens WHERE expires_at <= ? OR used_at IS NOT NULL', [new Date().toISOString()]);
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await database.run('INSERT INTO telegram_login_tokens (token_hash, phone, expires_at) VALUES (?, ?, ?)', [hashToken(token), phone, expiresAt]);
  const baseUrl = String(process.env.PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  return `${baseUrl}/api/client-auth/telegram-login?token=${encodeURIComponent(token)}`;
}

export async function consumeTelegramLoginToken(token) {
  const value = String(token || '');
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(value)) throw new HttpError(400, 'Некорректная ссылка входа');
  const now = new Date().toISOString();
  return transaction(async (client) => {
    const record = await client.one(`
      SELECT token_hash AS tokenHash, phone FROM telegram_login_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `, [hashToken(value), now]);
    if (!record) throw new HttpError(400, 'Ссылка входа недействительна или истекла');
    const used = await client.run('UPDATE telegram_login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', [now, record.tokenHash]);
    if (used.changes !== 1) throw new HttpError(400, 'Ссылка входа уже использована');
    const account = await client.one('SELECT phone, name FROM clients WHERE phone = ?', [record.phone]);
    if (!account) throw new HttpError(404, 'Клиентский аккаунт не найден');
    return account;
  });
}
