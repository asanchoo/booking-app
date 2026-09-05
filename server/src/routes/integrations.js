import crypto from 'crypto';
import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { checkAndSendReminders } from '../services/reminderService.js';
import { processTelegramUpdate } from '../services/telegramService.js';

const router = Router();

export function safeEqual(received, expected) {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

router.post('/telegram/webhook', rateLimit({ windowMs: 60 * 1000, max: 120, message: 'Слишком много обновлений Telegram.' }), async (req, res, next) => {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || !safeEqual(req.get('X-Telegram-Bot-Api-Secret-Token'), secret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await processTelegramUpdate(req.body);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/jobs/reminders', async (req, res, next) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = req.get('Authorization');
    if (!cronSecret || !safeEqual(authorization, `Bearer ${cronSecret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await checkAndSendReminders();
    return res.status(result.failures ? 503 : 200).json({ ok: !result.failures, ...result });
  } catch (error) {
    return next(error);
  }
});

export default router;
