import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const jwtSecret = process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';

  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (username !== adminUsername) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '7d' });

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({ success: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';
    jwt.verify(token, jwtSecret);
    return res.json({ authenticated: true });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

export default router;
