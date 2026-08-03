import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const services = db
    .prepare(
      `
      SELECT
        id,
        name,
        duration_minutes AS durationMinutes,
        price_cents AS priceCents
      FROM services
      WHERE is_active = 1
      ORDER BY id ASC
    `,
    )
    .all();

  res.json(services);
});

export default router;
