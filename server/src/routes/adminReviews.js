import { Router } from 'express';
import { db } from '../db/connection.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const reviews = db.prepare(`
      SELECT r.id, r.booking_id AS bookingId, r.rating, r.comment, r.source,
        r.comment_hidden AS commentHidden, r.created_at AS createdAt,
        b.client_name AS clientName,
        b.starts_at AS visitedAt, s.name AS serviceName,
        master.id AS masterId, master.name AS masterName
      FROM barber_reviews r
      JOIN bookings b ON b.id = r.booking_id
      JOIN services s ON s.id = b.service_id
      JOIN barbers master ON master.id = r.barber_id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 500
    `).all().map((review) => ({ ...review, commentHidden: Boolean(review.commentHidden) }));

    const summary = db.prepare(`
      SELECT COUNT(*) AS total,
        ROUND(COALESCE(AVG(rating), 0), 2) AS averageRating,
        SUM(CASE WHEN comment <> '' THEN 1 ELSE 0 END) AS withComment,
        SUM(CASE WHEN source = 'telegram' THEN 1 ELSE 0 END) AS fromTelegram,
        SUM(CASE WHEN comment_hidden = 1 THEN 1 ELSE 0 END) AS hiddenComments
      FROM barber_reviews
    `).get();
    const groupedRatings = db.prepare(`
      SELECT rating, COUNT(*) AS count
      FROM barber_reviews
      GROUP BY rating
    `).all();
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [rating, 0]));
    groupedRatings.forEach((row) => { distribution[row.rating] = row.count; });

    return res.json({ reviews, summary, distribution });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/visibility', (req, res, next) => {
  try {
    const reviewId = Number.parseInt(req.params.id, 10);
    const hidden = req.body?.hidden;
    if (!Number.isInteger(reviewId) || reviewId <= 0) throw new HttpError(400, 'Некорректный ID отзыва');
    if (typeof hidden !== 'boolean') throw new HttpError(400, 'Поле hidden должно быть логическим значением');

    const result = db.prepare(`
      UPDATE barber_reviews SET comment_hidden = ? WHERE id = ?
    `).run(hidden ? 1 : 0, reviewId);
    if (!result.changes) throw new HttpError(404, 'Отзыв не найден');
    return res.json({ success: true, id: reviewId, commentHidden: hidden });
  } catch (error) {
    return next(error);
  }
});

export default router;
