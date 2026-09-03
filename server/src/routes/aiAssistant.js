import express from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { createBooking } from '../services/bookingService.js';
import { getAiRuntimeStatus, getExternalAiRequestsToday, runAiAssistant } from '../services/aiAssistantService.js';
import { HttpError } from '../utils/httpError.js';
import { createTelegramLink } from '../services/telegramLinkService.js';
import { resolveVerifiedBookingTurn } from '../services/aiBookingFlow.js';

const router = express.Router();
const chatLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Слишком много сообщений AI-помощнику. Попробуйте чуть позже.' });
const bookingLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Слишком много попыток записи. Попробуйте позже.' });

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
    throw new HttpError(400, 'Отправьте от 1 до 12 сообщений');
  }
  return value.map((message) => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!content || content.length > 1200) throw new HttpError(400, 'Сообщение должно содержать от 1 до 1200 символов');
    return { role, content };
  });
}

router.get('/status', (req, res) => {
  const runtime = getAiRuntimeStatus();
  res.json({
    enabled: true,
    ...runtime,
    privacy: { storesMessages: false, sendsContactData: false, requiresBookingConfirmation: true },
  });
});

router.post('/chat', chatLimit, async (req, res, next) => {
  try {
    const messages = validateMessages(req.body?.messages);
    const runtime = getAiRuntimeStatus();
    const verified = resolveVerifiedBookingTurn({ messages, context: req.body?.context });
    if (verified) return res.json({ ...verified, provider: runtime.provider, fallback: false, verified: true });
    const dailyLimit = Math.max(1, Number(process.env.AI_DAILY_REQUEST_LIMIT) || 100);
    if (['openai', 'gemini'].includes(runtime.provider) && getExternalAiRequestsToday() >= dailyLimit) {
      const result = await runAiAssistant({ messages, clientIdentifier: req.ip, forceDemo: true });
      return res.json({ ...result, notice: 'Дневной лимит модели достигнут, включён демо-режим.' });
    }
    return res.json(await runAiAssistant({ messages, clientIdentifier: req.ip }));
  } catch (error) {
    return next(error);
  }
});

router.post('/book', bookingLimit, (req, res, next) => {
  try {
    if (req.body?.confirmed !== true) throw new HttpError(400, 'Перед записью необходимо явное подтверждение');
    const booking = createBooking({
      serviceId: Number(req.body.serviceId),
      barberId: Number(req.body.masterId),
      startsAt: req.body.startsAt,
      clientName: req.body.clientName,
      clientPhone: req.body.clientPhone,
      source: 'online',
      aiAssisted: true,
    });
    const telegram = createTelegramLink(booking.clientPhone);
    return res.status(201).json({ ...booking, telegram });
  } catch (error) {
    return next(error);
  }
});

export default router;
