import jwt from 'jsonwebtoken';

export function requireClientAuth(req, res, next) {
  const token = req.cookies?.client_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';
    const decoded = jwt.verify(token, jwtSecret);

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
