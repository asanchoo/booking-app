import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { database } from '../db/database.js';

export async function requireBarberAuth(req, res, next) {
  const token = req.cookies?.barber_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'barber' || !Number.isInteger(decoded.barberId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const active = await database.one('SELECT 1 FROM barber_accounts ba JOIN barbers b ON b.id = ba.barber_id WHERE ba.barber_id = ? AND b.is_active = 1', [decoded.barberId]);
    if (!active) return res.status(401).json({ error: 'Аккаунт мастера отключён' });
    req.barberId = decoded.barberId;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
