import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { database } from '../db/database.js';
import { getJwtSecret } from '../config/env.js';
import { requireClientAuth } from '../middleware/requireClientAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { normalizePhone } from '../utils/phone.js';
import { createTelegramLink } from '../services/telegramLinkService.js';
import { consumeTelegramLoginToken } from '../services/telegramLoginService.js';

const router = Router();
const CLIENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── POST /api/client-auth/register ──────────────────────────────────────────
// Temporary relaxed limit for demo and acceptance testing. Tighten before public launch.
router.post('/register', rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Слишком много регистраций. Попробуйте через несколько минут.' }), async (req, res, next) => {
  try {
    const { phone, password, name } = req.body || {};

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: 'Пароль должен содержать от 6 до 72 символов' });
    }

    const trimmedName = String(name || '').trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({ error: 'Имя должно содержать от 2 до 80 символов' });
    }

    // Check uniqueness
    const existing = await database.one('SELECT id FROM clients WHERE phone = ?', [cleanPhone]);
    if (existing) {
      return res.status(409).json({ error: 'Аккаунт с таким номером уже существует' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await database.run(`
      INSERT INTO clients (phone, password_hash, name)
      VALUES (?, ?, ?)
    `, [cleanPhone, password_hash, trimmedName]);

    return res.status(201).json({ success: true, phone: cleanPhone });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/client-auth/me ──────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.cookies?.client_token;
  if (!token) return res.json({ authenticated: false });

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'client' || !decoded.phone) return res.json({ authenticated: false });
    return res.json({ authenticated: true, phone: decoded.phone, name: decoded.name || '' });
  } catch {
    return res.json({ authenticated: false });
  }
});

// ─── POST /api/client-auth/logout ────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('client_token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true });
});

// ─── POST /api/client-auth/telegram/generate-link ───────────────────────────
router.post('/telegram/generate-link', requireClientAuth, async (req, res, next) => {
  try {
    return res.json(await createTelegramLink(req.clientPhone));
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/client-auth/telegram/status ───────────────────────────────────
router.get('/telegram/status', requireClientAuth, async (req, res, next) => {
  try {
    const phone = req.clientPhone;

    const linkRecord = await database.one('SELECT chat_id FROM telegram_links WHERE phone = ?', [phone]);
    const linked = Boolean(linkRecord && linkRecord.chat_id);
    return res.json({ linked });
  } catch (error) {
    next(error);
  }
});

router.get('/telegram-login', rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Слишком много попыток входа. Попробуйте позже.' }), async (req, res) => {
  try {
    const client = await consumeTelegramLoginToken(req.query?.token);
    const token = jwt.sign({ role: 'client', phone: client.phone, name: client.name }, getJwtSecret(), { expiresIn: '7d' });
    res.clearCookie('admin_token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('barber_token', { httpOnly: true, sameSite: 'lax' });
    res.cookie('client_token', token, CLIENT_COOKIE_OPTIONS);
    return res.redirect(303, '/my-account');
  } catch {
    return res.redirect(303, '/login?telegramLogin=expired');
  }
});

// ─── POST /api/client-auth/forgot-password/send-code ─────────────────────────
router.post('/forgot-password/send-code', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Слишком много запросов кода. Попробуйте через 15 минут.' }), async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    const linkRecord = await database.one('SELECT chat_id FROM telegram_links WHERE phone = ?', [cleanPhone]);
    if (!linkRecord || !linkRecord.chat_id) {
      return res.status(400).json({ error: 'Telegram не привязан, обратитесь в поддержку' });
    }

    // Rate-limit check (60 sec)
    const lastOtp = await database.one(`
        SELECT expires_at AS expiresAt
        FROM otp_codes
        WHERE phone = ?
        ORDER BY id DESC
        LIMIT 1
      `, [cleanPhone]);

    if (lastOtp?.expiresAt) {
      const createdAt = new Date(lastOtp.expiresAt).getTime() - 5 * 60 * 1000;
      const diffSeconds = (Date.now() - createdAt) / 1000;
      if (diffSeconds < 60) {
        const waitSeconds = Math.ceil(60 - diffSeconds);
        return res.status(429).json({
          error: `Повторная отправка возможна через ${waitSeconds} сек.`,
          retryAfter: waitSeconds,
        });
      }
    }

    const code = String(crypto.randomInt(1000, 10000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await database.run('INSERT INTO otp_codes (phone, code, expires_at, used) VALUES (?, ?, ?, 0)', [cleanPhone, code, expiresAt]);

    await sendTelegramMessage(linkRecord.chat_id, `🔑 Код для восстановления пароля BarberShop: *${code}*`, {
      parse_mode: 'Markdown',
    });

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/client-auth/forgot-password/reset ──────────────────────────────
router.post('/forgot-password/reset', async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    const cleanCode = String(code || '').trim();

    if (!cleanPhone || !cleanCode || !newPassword) {
      return res.status(400).json({ error: 'Укажите телефон, код и новый пароль' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const nowIso = new Date().toISOString();
    const otpRecord = await database.one(`
        SELECT id FROM otp_codes
        WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ?
        ORDER BY id DESC LIMIT 1
      `, [cleanPhone, cleanCode, nowIso]);

    if (!otpRecord) {
      return res.status(400).json({ error: 'Неверный или истёкший код' });
    }

    await database.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otpRecord.id]);

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = await database.run('UPDATE clients SET password_hash = ? WHERE phone = ?', [password_hash, cleanPhone]);

    if (updated.changes === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
