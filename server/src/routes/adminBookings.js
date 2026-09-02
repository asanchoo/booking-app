import { Router } from 'express';
import { createBooking } from '../services/bookingService.js';

const router = Router();

router.post('/', (req, res, next) => {
  try {
    const booking = createBooking({ ...req.body, source: 'admin' });
    return res.status(201).json(booking);
  } catch (error) {
    return next(error);
  }
});

export default router;
