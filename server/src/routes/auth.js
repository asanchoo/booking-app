import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const JWT_SECRET = () => process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Unified login: accepts { login, password }
// login can be ADMIN_USERNAME or a client phone number
router.post('/login', async (req, res) => {
  const { login, password } = req.body || {};

  if (!login || !password) {
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

    const token = jwt.sign({ role: 'admin' }, JWT_SECRET(), { expiresIn: '7d' });
    res.cookie('admin_token', token, COOKIE_OPTS);
    return res.json({ success: true, role: 'admin' });
  }

  // 2. Try client (by phone — normalize digits only)
  const cleanPhone = String(login).replace(/\D/g, '');
  let phoneVariant = cleanPhone;
  if (phoneVariant.startsWith('8') && phoneVariant.length === 11) {
    phoneVariant = '7' + phoneVariant.slice(1);
  }

  // Look up client by any common phone variant
  const client = db
    .prepare(`SELECT id, phone, password_hash, name FROM clients WHERE phone = ? OR phone = ?`)
    .get(cleanPhone, phoneVariant);

  if (!client) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const isValid = await bcrypt.compare(password, client.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign({ role: 'client', phone: client.phone, name: client.name }, JWT_SECRET(), { expiresIn: '7d' });
  res.cookie('client_token', token, COOKIE_OPTS);
  return res.json({ success: true, role: 'client', phone: client.phone, name: client.name });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('client_token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Returns the currently authenticated user regardless of role
router.get('/me', (req, res) => {
  // Check admin first
  const adminToken = req.cookies?.admin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, JWT_SECRET());
      if (decoded.role === 'admin') {
        return res.json({ authenticated: true, role: 'admin' });
      }
    } catch { /* fall through */ }
  }

  // Check client
  const clientToken = req.cookies?.client_token;
  if (clientToken) {
    try {
      const decoded = jwt.verify(clientToken, JWT_SECRET());
      if (decoded.role === 'client' && decoded.phone) {
        return res.json({ authenticated: true, role: 'client', phone: decoded.phone, name: decoded.name || '' });
      }
    } catch { /* fall through */ }
  }

  return res.json({ authenticated: false });
});

export default router;
