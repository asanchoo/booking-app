import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { createBooking, listBookings, rescheduleBooking } from '../services/bookingService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || 'default_fallback_secret_key_32bytes';

router.get('/', requireAuth, (req, res) => {
  res.json(listBookings());
});

router.post('/', (req, res, next) => {
  try {
    const booking = createBooking(req.body);
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/reschedule
router.post('/:id/reschedule', (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Неверный ID записи' });
    }

    const { newStartsAt, clientPhone: bodyPhone, phone: bodyPhone2 } = req.body || {};
    if (!newStartsAt) {
      return res.status(400).json({ error: 'Укажите новое время newStartsAt' });
    }

    // Determine requesting client phone (from cookie token or body)
    let clientPhone = bodyPhone || bodyPhone2 || '';

    const token = req.cookies?.client_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET());
        if (decoded.role === 'client' && decoded.phone) {
          clientPhone = decoded.phone;
        }
      } catch {
        // Token invalid, fall back to body phone
      }
    }

    if (!clientPhone) {
      return res.status(401).json({ error: 'Не указан номер телефона клиента' });
    }

    // Check ownership
    const booking = db
      .prepare('SELECT id, client_phone FROM bookings WHERE id = ?')
      .get(bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const ownerDigits = String(booking.client_phone).replace(/\D/g, '').slice(-10);
    const clientDigits = String(clientPhone).replace(/\D/g, '').slice(-10);

    if (ownerDigits !== clientDigits) {
      return res.status(403).json({ error: 'Нет прав для переноса этой записи' });
    }

    const updated = rescheduleBooking(bookingId, newStartsAt);
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
