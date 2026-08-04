import { Router } from 'express';
import { createBooking, listBookings } from '../services/bookingService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

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

export default router;
