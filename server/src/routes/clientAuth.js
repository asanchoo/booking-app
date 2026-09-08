import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { database, transaction } from '../db/database.js';
import { getJwtSecret } from '../config/env.js';
import { requireClientAuth } from '../middleware/requireClientAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { normalizePhone } from '../utils/phone.js';
import { createTelegramLink } from '../services/telegramLinkService.js';
import { consumeTelegramLoginToken } from '../services/telegramLoginService.js';
import { createOtpCode, hashOtp, otpMatches } from '../services/otpSecurity.js';
import { hasExplicitLegalConsent, LEGAL_DOCUMENT_VERSION, legalConsentTimestamp } from '../services/legalConsent.js';

const router = Router();
const MIN_PASSWORD_LENGTH = 8;
const MAX_OTP_ATTEMPTS = 5;
const CLIENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── POST /api/client-auth/register ──────────────────────────────────────────
router.post('/register', rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Слишком много регистраций. Попробуйте через несколько минут.' }), async (req, res, next) => {
  try {
    const { phone, password, name, legalConsent } = req.body || {};

    if (!hasExplicitLegalConsent(legalConsent)) {
      return res.status(400).json({ error: 'Для регистрации необходимо принять условия и согласиться на обработку персональных данных' });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
      return res.status(400).json({ error: `Пароль должен содержать от ${MIN_PASSWORD_LENGTH} до 72 символов` });
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
      INSERT INTO clients (phone, password_hash, name, legal_consent_at, legal_version)
      VALUES (?, ?, ?, ?, ?)
    `, [cleanPhone, password_hash, trimmedName, legalConsentTimestamp(), LEGAL_DOCUMENT_VERSION]);

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
router.post('/forgot-password/send-code', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много запросов кода. Попробуйте через 15 минут.',
  keyGenerator: (req) => normalizePhone(req.body?.phone),
}), async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    const linkRecord = await database.one('SELECT chat_id FROM telegram_links WHERE phone = ?', [cleanPhone]);
    if (!linkRecord || !linkRecord.chat_id) {
      // Do not reveal whether a phone number is registered or linked.
      return res.json({ success: true });
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

    const code = createOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await transaction(async (tx) => {
      await tx.run('UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0', [cleanPhone]);
      await tx.run(
        'INSERT INTO otp_codes (phone, code, expires_at, used, attempts) VALUES (?, ?, ?, 0, 0)',
        [cleanPhone, hashOtp(cleanPhone, code, getJwtSecret()), expiresAt],
      );
    });

    await sendTelegramMessage(linkRecord.chat_id, `🔑 Код для восстановления пароля BarberShop: *${code}*`, {
      parse_mode: 'Markdown',
    });

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/client-auth/forgot-password/reset ──────────────────────────────
router.post('/forgot-password/reset', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Слишком много попыток проверки кода. Запросите новый код позже.',
  keyGenerator: (req) => normalizePhone(req.body?.phone),
}), async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    const cleanCode = String(code || '').trim();

    if (!cleanPhone || !cleanCode || !newPassword) {
      return res.status(400).json({ error: 'Укажите телефон, код и новый пароль' });
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Введите 6-значный код из Telegram' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 72) {
      return res.status(400).json({ error: `Пароль должен содержать от ${MIN_PASSWORD_LENGTH} до 72 символов` });
    }

    const nowIso = new Date().toISOString();
    const resetResult = await transaction(async (tx) => {
      const lock = tx.dialect === 'postgres' ? ' FOR UPDATE' : '';
      const otpRecord = await tx.one(`
        SELECT id, code, attempts
        FROM otp_codes
        WHERE phone = ? AND used = 0 AND expires_at > ?
        ORDER BY id DESC LIMIT 1${lock}
      `, [cleanPhone, nowIso]);

      if (!otpRecord) return 'invalid';

      const attempts = Number(otpRecord.attempts || 0) + 1;
      const valid = otpMatches(otpRecord.code, hashOtp(cleanPhone, cleanCode, getJwtSecret()));
      if (!valid) {
        await tx.run('UPDATE otp_codes SET attempts = ?, used = ? WHERE id = ?', [
          attempts,
          attempts >= MAX_OTP_ATTEMPTS ? 1 : 0,
          otpRecord.id,
        ]);
        return attempts >= MAX_OTP_ATTEMPTS ? 'locked' : 'invalid';
      }

      await tx.run('UPDATE otp_codes SET attempts = ?, used = 1 WHERE id = ?', [attempts, otpRecord.id]);
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updated = await tx.run('UPDATE clients SET password_hash = ? WHERE phone = ?', [passwordHash, cleanPhone]);
      return updated.changes === 0 ? 'missing' : 'success';
    });

    if (resetResult === 'locked') {
      return res.status(429).json({ error: 'Код заблокирован после нескольких ошибок. Запросите новый код.' });
    }
    if (resetResult === 'invalid') {
      return res.status(400).json({ error: 'Неверный или истёкший код' });
    }
    if (resetResult === 'missing') {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
