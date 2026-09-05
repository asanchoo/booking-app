import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { database } from '../db/database.js';
import { getJwtSecret } from '../config/env.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function clearRoleCookies(res, keepRole) {
  const cookieByRole = { admin: 'admin_token', client: 'client_token', barber: 'barber_token' };
  Object.entries(cookieByRole).forEach(([role, cookie]) => {
    if (role !== keepRole) res.clearCookie(cookie, { httpOnly: true, sameSite: 'lax' });
  });
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Unified login: accepts { login, password }
// login can be ADMIN_USERNAME or a client phone number
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Слишком много попыток входа. Попробуйте через 15 минут.' }), async (req, res) => {
  const { login, password } = req.body || {};

  if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password || login.length > 100 || password.length > 72) {
    return res.status(401).json({ error: 'Введите логин и пароль' });
  }

  // 1. Try admin
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (login === adminUsername) {
    const isValid = await bcrypt.compare(password, adminPasswordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: '7d' });
    clearRoleCookies(res, 'admin');
    res.cookie('admin_token', token, COOKIE_OPTS);
    return res.json({ success: true, role: 'admin' });
  }

  // 2. Try client (by phone — normalize digits only)
  const cleanPhone = String(login).replace(/\D/g, '');
  const phoneVariant = normalizePhone(login);

  // Look up client by any common phone variant
  const client = await database.one(
    'SELECT id, phone, password_hash, name FROM clients WHERE phone = ? OR phone = ?',
    [cleanPhone, phoneVariant],
  );

  if (client) {
    const isValid = await bcrypt.compare(password, client.password_hash);
    if (isValid) {
      const token = jwt.sign({ role: 'client', phone: client.phone, name: client.name }, getJwtSecret(), { expiresIn: '7d' });
      clearRoleCookies(res, 'client');
      res.cookie('client_token', token, COOKIE_OPTS);
      return res.json({ success: true, role: 'client', phone: client.phone, name: client.name });
    }
  }

  // 3. Try barber account by its username.
  const barberAccount = await database.one(`
    SELECT ba.barber_id AS barberId, ba.password_hash AS passwordHash, b.name
    FROM barber_accounts ba
    JOIN barbers b ON b.id = ba.barber_id
    WHERE lower(ba.username) = lower(?) AND b.is_active = 1
  `, [String(login).trim()]);

  if (!barberAccount || !(await bcrypt.compare(password, barberAccount.passwordHash))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign(
    { role: 'barber', barberId: barberAccount.barberId, name: barberAccount.name },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
  clearRoleCookies(res, 'barber');
  res.cookie('barber_token', token, COOKIE_OPTS);
  return res.json({ success: true, role: 'barber', barberId: barberAccount.barberId, name: barberAccount.name });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('client_token', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('barber_token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Returns the currently authenticated user regardless of role
router.get('/me', (req, res) => {
  // Check admin first
  const adminToken = req.cookies?.admin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, getJwtSecret());
      if (decoded.role === 'admin') {
        return res.json({ authenticated: true, role: 'admin' });
      }
    } catch { /* fall through */ }
  }

  // Check client
  const clientToken = req.cookies?.client_token;
  if (clientToken) {
    try {
      const decoded = jwt.verify(clientToken, getJwtSecret());
      if (decoded.role === 'client' && decoded.phone) {
        return res.json({ authenticated: true, role: 'client', phone: decoded.phone, name: decoded.name || '' });
      }
    } catch { /* fall through */ }
  }

  const barberToken = req.cookies?.barber_token;
  if (barberToken) {
    try {
      const decoded = jwt.verify(barberToken, getJwtSecret());
      if (decoded.role === 'barber' && Number.isInteger(decoded.barberId)) {
        return res.json({ authenticated: true, role: 'barber', barberId: decoded.barberId, name: decoded.name || '' });
      }
    } catch { /* fall through */ }
  }

  return res.json({ authenticated: false });
});

export default router;
