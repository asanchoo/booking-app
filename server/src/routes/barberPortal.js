import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireBarberAuth } from '../middleware/requireBarberAuth.js';
import { applyClientRatingEvent } from '../services/clientRatingService.js';
import { HttpError } from '../utils/httpError.js';
import { formatDateTime, parseDateTimeParam } from '../utils/datetime.js';
import { normalizePhone } from '../utils/phone.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { barberPhotoUpload, replaceBarberPhoto } from '../services/barberPhotoService.js';

const router = Router();
router.use(requireBarberAuth);

router.get('/me', (req, res, next) => {
  try {
    const barber = db.prepare(`
      SELECT b.id, b.name, b.photo_url AS photoUrl
      FROM barbers b
      WHERE b.id = ? AND b.is_active = 1
    `).get(req.barberId);
    if (!barber) return res.status(401).json({ error: 'Аккаунт мастера отключён' });
    return res.json(barber);
  } catch (error) {
    return next(error);
  }
});

router.post('/me/photo', rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Слишком много попыток загрузки. Попробуйте позже.' }), (req, res, next) => {
  barberPhotoUpload.single('photo')(req, res, (uploadError) => {
    if (uploadError) {
      const error = new Error(uploadError.code === 'LIMIT_FILE_SIZE' ? 'Размер фотографии не должен превышать 5 МБ' : uploadError.message);
      error.status = 400;
      return next(error);
    }
    try {
      return res.json(replaceBarberPhoto({ barberId: req.barberId, file: req.file }));
    } catch (error) {
      return next(error);
    }
  });
});

router.get('/bookings', (req, res, next) => {
  try {
    const bookings = db.prepare(`
      SELECT b.id, b.client_name AS clientName, b.client_phone AS clientPhone,
        b.starts_at AS startsAt, b.ends_at AS endsAt, b.status,
        b.attendance_status AS attendanceStatus, s.name AS serviceName,
        COALESCE(cr.rating, 5) AS clientRating,
        COALESCE(mcn.note, '') AS clientNote
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      LEFT JOIN client_ratings cr ON cr.phone = b.client_phone
      LEFT JOIN master_client_notes mcn ON mcn.master_id = b.barber_id AND mcn.client_phone = b.client_phone
      WHERE b.barber_id = ?
      ORDER BY b.starts_at ASC
    `).all(req.barberId);
    return res.json(bookings);
  } catch (error) {
    return next(error);
  }
});

router.get('/reviews', (req, res, next) => {
  try {
    const reviews = db.prepare(`
      SELECT r.id, r.rating, r.comment, r.source,
        r.comment_hidden AS commentHidden, r.created_at AS createdAt,
        b.client_name AS clientName, s.name AS serviceName
      FROM barber_reviews r
      JOIN bookings b ON b.id = r.booking_id
      JOIN services s ON s.id = b.service_id
      WHERE r.barber_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 100
    `).all(req.barberId).map((review) => ({ ...review, commentHidden: Boolean(review.commentHidden) }));

    const summary = db.prepare(`
      SELECT COUNT(*) AS total, ROUND(COALESCE(AVG(rating), 0), 2) AS averageRating,
        SUM(CASE WHEN comment <> '' THEN 1 ELSE 0 END) AS withComment,
        SUM(CASE WHEN source = 'telegram' THEN 1 ELSE 0 END) AS fromTelegram
      FROM barber_reviews
      WHERE barber_id = ?
    `).get(req.barberId);
    const grouped = db.prepare(`
      SELECT rating, COUNT(*) AS count
      FROM barber_reviews
      WHERE barber_id = ?
      GROUP BY rating
    `).all(req.barberId);
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [rating, 0]));
    grouped.forEach((row) => { distribution[row.rating] = row.count; });

    return res.json({ reviews, summary, distribution });
  } catch (error) {
    return next(error);
  }
});

router.put('/clients/:phone/note', (req, res, next) => {
  try {
    const phone = normalizePhone(req.params.phone);
    const note = String(req.body?.note || '').trim();
    if (!phone || phone.length < 10) throw new HttpError(400, 'Некорректный номер клиента');
    if (note.length > 500) throw new HttpError(400, 'Заметка не должна превышать 500 символов');

    const knownClient = db.prepare('SELECT 1 FROM bookings WHERE barber_id = ? AND client_phone = ? LIMIT 1').get(req.barberId, phone);
    if (!knownClient) throw new HttpError(404, 'Клиент не найден среди ваших записей');

    if (note) {
      db.prepare(`
        INSERT INTO master_client_notes (master_id, client_phone, note, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(master_id, client_phone) DO UPDATE SET note = excluded.note, updated_at = datetime('now')
      `).run(req.barberId, phone, note);
    } else {
      db.prepare('DELETE FROM master_client_notes WHERE master_id = ? AND client_phone = ?').run(req.barberId, phone);
    }
    return res.json({ success: true, phone, note });
  } catch (error) {
    return next(error);
  }
});

router.get('/time-blocks', (req, res, next) => {
  try {
    const blocks = db.prepare(`
      SELECT id, starts_at AS startsAt, ends_at AS endsAt, reason
      FROM master_time_blocks
      WHERE master_id = ? AND ends_at >= ?
      ORDER BY starts_at ASC
    `).all(req.barberId, formatDateTime(new Date()));
    return res.json(blocks);
  } catch (error) {
    return next(error);
  }
});

router.post('/time-blocks', (req, res, next) => {
  try {
    const startsAt = parseDateTimeParam(req.body?.startsAt);
    const endsAt = parseDateTimeParam(req.body?.endsAt);
    const reason = String(req.body?.reason || '').trim();
    if (!startsAt || !endsAt || endsAt <= startsAt) throw new HttpError(400, 'Проверьте время начала и окончания');
    if (startsAt <= formatDateTime(new Date())) throw new HttpError(400, 'Нельзя создать перерыв в прошлом');
    if (new Date(endsAt).getTime() - new Date(startsAt).getTime() > 7 * 86400000) throw new HttpError(400, 'Блокировка не может быть длиннее 7 дней');
    if (reason.length > 100) throw new HttpError(400, 'Причина не должна превышать 100 символов');

    const bookingConflict = db.prepare(`
      SELECT id FROM bookings
      WHERE barber_id = ? AND status = 'confirmed' AND starts_at < ? AND ends_at > ?
      LIMIT 1
    `).get(req.barberId, endsAt, startsAt);
    if (bookingConflict) throw new HttpError(409, 'На это время уже есть запись клиента');

    const blockConflict = db.prepare(`
      SELECT id FROM master_time_blocks
      WHERE master_id = ? AND starts_at < ? AND ends_at > ?
      LIMIT 1
    `).get(req.barberId, endsAt, startsAt);
    if (blockConflict) throw new HttpError(409, 'Этот интервал пересекается с другим перерывом');

    const result = db.prepare(`
      INSERT INTO master_time_blocks (master_id, starts_at, ends_at, reason)
      VALUES (?, ?, ?, ?)
    `).run(req.barberId, startsAt, endsAt, reason);
    return res.status(201).json({ id: result.lastInsertRowid, startsAt, endsAt, reason });
  } catch (error) {
    return next(error);
  }
});

router.delete('/time-blocks/:id', (req, res, next) => {
  try {
    const blockId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(blockId) || blockId <= 0) throw new HttpError(400, 'Некорректный ID перерыва');
    const result = db.prepare('DELETE FROM master_time_blocks WHERE id = ? AND master_id = ?').run(blockId, req.barberId);
    if (!result.changes) throw new HttpError(404, 'Перерыв не найден');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/bookings/:id/attendance', (req, res, next) => {
  try {
    const bookingId = Number.parseInt(req.params.id, 10);
    const attendanceStatus = req.body?.attendanceStatus;
    if (!Number.isInteger(bookingId) || bookingId <= 0) throw new HttpError(400, 'Некорректный ID записи');
    if (!['attended', 'no_show'].includes(attendanceStatus)) {
      throw new HttpError(400, 'Допустимы статусы attended или no_show');
    }

    const booking = db.prepare(`
      SELECT id, client_phone, starts_at AS startsAt, ends_at AS endsAt,
        status, attendance_status AS attendanceStatus
      FROM bookings WHERE id = ? AND barber_id = ?
    `).get(bookingId, req.barberId);
    if (!booking) throw new HttpError(404, 'Запись не найдена');
    if (booking.status === 'cancelled') throw new HttpError(400, 'Нельзя отметить отменённую запись');
    const now = Date.now();
    if (attendanceStatus === 'attended' && new Date(booking.startsAt).getTime() - now > 2 * 60 * 60 * 1000) {
      throw new HttpError(400, 'Отметить приход можно не раньше чем за 2 часа до визита');
    }
    if (attendanceStatus === 'no_show' && new Date(booking.endsAt).getTime() > now) {
      throw new HttpError(400, 'Отметить неявку можно только после окончания записи');
    }

    db.prepare('UPDATE bookings SET attendance_status = ? WHERE id = ?').run(attendanceStatus, bookingId);
    let rating = null;
    if (attendanceStatus === 'no_show') {
      rating = applyClientRatingEvent({
        phone: booking.client_phone,
        bookingId,
        eventType: 'no_show',
        delta: -1,
      }).rating;
    }
    return res.json({ success: true, attendanceStatus, clientRating: rating });
  } catch (error) {
    return next(error);
  }
});

export default router;
