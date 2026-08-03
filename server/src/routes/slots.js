import { Router } from 'express';
import { getAvailableSlots } from '../services/slotService.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const serviceId = Number(req.query.serviceId);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      throw new HttpError(400, 'serviceId query parameter is required');
    }

    const result = getAvailableSlots(serviceId, req.query.from, req.query.to);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
