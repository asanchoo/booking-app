import { Router } from 'express';
import { database } from '../db/database.js';
import { createBooking, listBookings, rescheduleBooking } from '../services/bookingService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireClientAuth } from '../middleware/requireClientAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(await listBookings()); } catch (error) { next(error); }
});

router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Слишком много попыток записи. Попробуйте позже.' }), async (req, res, next) => {
  try {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/reschedule
router.post('/:id/reschedule', requireClientAuth, async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Неверный ID записи' });
    }

    const { newStartsAt } = req.body || {};
    if (!newStartsAt) {
      return res.status(400).json({ error: 'Укажите новое время newStartsAt' });
    }

    const clientPhone = req.clientPhone;

    // Check ownership
    const booking = await database.one('SELECT id, client_phone FROM bookings WHERE id = ?', [bookingId]);

    if (!booking) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const ownerDigits = String(booking.client_phone).replace(/\D/g, '').slice(-10);
    const clientDigits = String(clientPhone).replace(/\D/g, '').slice(-10);

    if (ownerDigits !== clientDigits) {
      return res.status(403).json({ error: 'Нет прав для переноса этой записи' });
    }

    const updated = await rescheduleBooking(bookingId, newStartsAt);
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
