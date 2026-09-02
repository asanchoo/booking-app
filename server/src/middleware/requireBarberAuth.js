import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export function requireBarberAuth(req, res, next) {
  const token = req.cookies?.barber_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'barber' || !Number.isInteger(decoded.barberId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.barberId = decoded.barberId;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
