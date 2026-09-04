import { Router } from 'express';
import { database } from '../db/database.js';
import { listClientBookings, cancelBooking } from '../services/bookingService.js';
import { requireClientAuth } from '../middleware/requireClientAuth.js';
import { assertBookingCanBeChanged } from '../utils/bookingPolicy.js';
import { createMasterReview } from '../services/reviewService.js';

const router = Router();

// GET /api/my-bookings
router.get('/', requireClientAuth, async (req, res, next) => {
  try {
    const bookings = await listClientBookings(req.clientPhone);
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

// POST /api/my-bookings/:id/cancel
router.post('/:id/cancel', requireClientAuth, async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Неверный ID записи' });
    }

    // Fetch the booking
    const booking = await database.one(`
        SELECT b.id, b.client_phone, b.status, b.starts_at
        FROM bookings b
        WHERE b.id = ?
      `, [bookingId]);

    if (!booking) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    // Ownership check: compare last 10 digits to handle phone format variants
    const ownerDigits = String(booking.client_phone).replace(/\D/g, '').slice(-10);
    const clientDigits = String(req.clientPhone).replace(/\D/g, '').slice(-10);
    if (ownerDigits !== clientDigits) {
      return res.status(403).json({ error: 'Нет прав для отмены этой записи' });
    }

    // Check status
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Запись уже отменена' });
    }

    assertBookingCanBeChanged(booking.starts_at);

    await cancelBooking(bookingId);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/review', requireClientAuth, async (req, res, next) => {
  try {
    const bookingId = Number.parseInt(req.params.id, 10);
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim().slice(0, 500);
    const review = await createMasterReview({ bookingId, clientPhone: req.clientPhone, rating, comment, source: 'website' });
    return res.status(201).json({ success: true, review });
  } catch (error) {
    return next(error);
  }
});

export default router;
