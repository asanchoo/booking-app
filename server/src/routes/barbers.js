import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const barbers = db
    .prepare(
      `
      SELECT
        id,
        name,
        photo_url AS photoUrl,
        sort_order AS sortOrder
      FROM barbers
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `,
    )
    .all();

  res.json(barbers);
});

export default router;
