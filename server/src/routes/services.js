import { Router } from 'express';
import { database } from '../db/database.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const services = await database.all(`
      SELECT
        id,
        name,
        description,
        duration_minutes AS durationMinutes,
        price_cents AS priceCents
      FROM services
      WHERE is_active = 1
      ORDER BY id ASC
    `);
    res.json(services);
  } catch (error) {
    next(error);
  }
});

export default router;
