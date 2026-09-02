import { HttpError } from '../utils/httpError.js';

const buckets = new Map();

function getClientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.path}:${getClientKey(req)}`;
    const entries = (buckets.get(key) || []).filter((time) => now - time < windowMs);

    if (entries.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - entries[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return next(new HttpError(429, message || 'Слишком много запросов. Попробуйте позже.'));
    }

    entries.push(now);
    buckets.set(key, entries);
    return next();
  };
}
