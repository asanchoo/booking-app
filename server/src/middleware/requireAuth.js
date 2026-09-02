import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
