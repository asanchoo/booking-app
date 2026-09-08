import { HttpError } from '../utils/httpError.js';
import { database } from '../db/database.js';

function getClientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit({ windowMs, max, message, keyGenerator }) {
  return async (req, res, next) => {
    const now = Date.now();
    const resetAt = new Date(now + windowMs).toISOString();
    const extraKey = typeof keyGenerator === 'function' ? String(keyGenerator(req) || '') : '';
    const key = `${req.baseUrl}${req.path}:${getClientKey(req)}:${extraKey}`;

    try {
      const bucket = await database.one(`
        INSERT INTO rate_limit_buckets (key, count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = CASE
            WHEN rate_limit_buckets.reset_at <= ? THEN 1
            ELSE rate_limit_buckets.count + 1
          END,
          reset_at = CASE
            WHEN rate_limit_buckets.reset_at <= ? THEN excluded.reset_at
            ELSE rate_limit_buckets.reset_at
          END
        RETURNING count, reset_at AS resetAt
      `, [key, resetAt, new Date(now).toISOString(), new Date(now).toISOString()]);

      if (Number(bucket.count) > max) {
        const retryAfter = Math.max(1, Math.ceil((new Date(bucket.resetAt).getTime() - now) / 1000));
        res.set('Retry-After', String(retryAfter));
        return next(new HttpError(429, message || 'Слишком много запросов. Попробуйте позже.'));
      }

      if (Math.random() < 0.01) {
        database.run('DELETE FROM rate_limit_buckets WHERE reset_at <= ?', [new Date(now - windowMs).toISOString()]).catch(() => {});
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
