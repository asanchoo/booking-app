import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const query = db
    .prepare(
      `
      SELECT
        b.id,
        b.name,
        b.photo_url AS photoUrl,
        b.sort_order AS sortOrder,
        ROUND(COALESCE(AVG(r.rating), 5), 2) AS rating,
        COUNT(r.id) AS reviewCount,
        (
          SELECT recent.comment
          FROM barber_reviews recent
          WHERE recent.barber_id = b.id AND recent.comment <> '' AND recent.comment_hidden = 0
          ORDER BY recent.created_at DESC, recent.id DESC
          LIMIT 1
        ) AS latestReviewComment,
        (
          SELECT booking.client_name
          FROM barber_reviews recent
          JOIN bookings booking ON booking.id = recent.booking_id
          WHERE recent.barber_id = b.id AND recent.comment <> '' AND recent.comment_hidden = 0
          ORDER BY recent.created_at DESC, recent.id DESC
          LIMIT 1
        ) AS latestReviewAuthor
      FROM barbers b
      LEFT JOIN barber_reviews r ON r.barber_id = b.id
      ${req.query.serviceId ? 'JOIN service_masters sm ON sm.master_id = b.id AND sm.service_id = ?' : ''}
      WHERE b.is_active = 1
      GROUP BY b.id
      ORDER BY b.sort_order ASC
    `,
    );

  const serviceId = Number(req.query.serviceId);
  if (req.query.serviceId && (!Number.isInteger(serviceId) || serviceId <= 0)) {
    return res.status(400).json({ message: 'Некорректная услуга' });
  }

  const barbers = query.all(...(req.query.serviceId ? [serviceId] : [])).map((barber) => ({
    ...barber,
    latestReviewAuthor: String(barber.latestReviewAuthor || '').trim().split(/\s+/)[0] || null,
  }));

  res.json(barbers);
});

export default router;
