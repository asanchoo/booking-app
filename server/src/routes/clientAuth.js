import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { requireClientAuth } from '../middleware/requireClientAuth.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = () => process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';

// ─── POST /api/client-auth/register ──────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { phone, password, name } = req.body || {};

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const trimmedName = String(name || '').trim();

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM clients WHERE phone = ?').get(cleanPhone);
    if (existing) {
      return res.status(409).json({ error: 'Аккаунт с таким номером уже существует' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO clients (phone, password_hash, name)
      VALUES (?, ?, ?)
    `).run(cleanPhone, password_hash, trimmedName);

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
    const decoded = jwt.verify(token, JWT_SECRET());
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

// ─── POST /api/client-auth/telegram/generate-link (Public by phone) ─────────
router.post('/telegram/generate-link', (req, res, next) => {
  try {
    const { phone: rawPhone } = req.body || {};
    const phone = normalizePhone(rawPhone);

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'barbershop_astanabot';

    // Generate random 8-char hex code
    const code = Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins TTL

    db.prepare(`INSERT OR REPLACE INTO telegram_linking_codes (code, phone, expires_at) VALUES (?, ?, ?)`)
      .run(code, phone, expiresAt);

    const link = `https://t.me/${botUsername}?start=${code}`;
    return res.json({ link });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/client-auth/telegram/status (Public by query phone) ─────────────
router.get('/telegram/status', (req, res, next) => {
  try {
    const rawPhone = req.query.phone;
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return res.json({ linked: false });
    }

    const linkRecord = db.prepare(`SELECT chat_id FROM telegram_links WHERE phone = ?`).get(phone);
    const linked = Boolean(linkRecord && linkRecord.chat_id);
    return res.json({ linked });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/client-auth/forgot-password/send-code ─────────────────────────
router.post('/forgot-password/send-code', async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона' });
    }

    const linkRecord = db.prepare('SELECT chat_id FROM telegram_links WHERE phone = ?').get(cleanPhone);
    if (!linkRecord || !linkRecord.chat_id) {
      return res.status(400).json({ error: 'Telegram не привязан, обратитесь в поддержку' });
    }

    // Rate-limit check (60 sec)
    const lastOtp = db
      .prepare(`
        SELECT datetime(expires_at, '-5 minutes') as created_at
        FROM otp_codes
        WHERE phone = ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(cleanPhone);

    if (lastOtp?.created_at) {
      const diffSeconds = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000;
      if (diffSeconds < 60) {
        const waitSeconds = Math.ceil(60 - diffSeconds);
        return res.status(429).json({
          error: `Повторная отправка возможна через ${waitSeconds} сек.`,
          retryAfter: waitSeconds,
        });
      }
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`INSERT INTO otp_codes (phone, code, expires_at, used) VALUES (?, ?, ?, 0)`)
      .run(cleanPhone, code, expiresAt);

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

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const nowIso = new Date().toISOString();
    const otpRecord = db
      .prepare(`
        SELECT id FROM otp_codes
        WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ?
        ORDER BY id DESC LIMIT 1
      `)
      .get(cleanPhone, cleanCode, nowIso);

    if (!otpRecord) {
      return res.status(400).json({ error: 'Неверный или истёкший код' });
    }

    db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otpRecord.id);

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = db
      .prepare('UPDATE clients SET password_hash = ? WHERE phone = ?')
      .run(password_hash, cleanPhone);

    if (updated.changes === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
