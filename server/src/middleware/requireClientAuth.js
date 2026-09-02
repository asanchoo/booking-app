import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export function requireClientAuth(req, res, next) {
  const token = req.cookies?.client_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role !== 'client' || !decoded.phone) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.clientPhone = decoded.phone;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
