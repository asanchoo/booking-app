import { HttpError } from '../utils/httpError.js';

export function corsOptions(req, callback) {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5176')
    .split(',').map((value) => value.trim()).filter(Boolean);
  for (const key of ['VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_BRANCH_URL']) {
    if (process.env[key]) allowedOrigins.push(`https://${process.env[key]}`);
  }
  // Vercel serves the frontend and API on the same host, including custom domains.
  // Use the request Host, never a client-supplied forwarded host or wildcard suffix.
  const sameOrigin = `${process.env.VERCEL ? 'https' : req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  if (!origin || origin === sameOrigin || allowedOrigins.includes(origin)) {
    return callback(null, { origin: true, credentials: true });
  }
  return callback(new HttpError(403, 'Запрос с этого сайта не разрешён'));
}
