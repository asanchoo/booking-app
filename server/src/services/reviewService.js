import { database } from '../db/database.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';

async function getOwnedAttendedBooking(bookingId, clientPhone) {
  const booking = await database.one(`
    SELECT id, barber_id AS barberId, client_phone AS clientPhone,
      attendance_status AS attendanceStatus
    FROM bookings
    WHERE id = ?
  `, [bookingId]);

  if (!booking) throw new HttpError(404, 'Запись не найдена');
  if (normalizePhone(booking.clientPhone) !== normalizePhone(clientPhone)) {
    throw new HttpError(403, 'Нет прав для этого отзыва');
  }
  if (!booking.barberId || booking.attendanceStatus !== 'attended') {
    throw new HttpError(400, 'Оставить отзыв можно после отмеченного визита');
  }
  return booking;
}

export async function createMasterReview({ bookingId, clientPhone, rating, comment = '', source = 'website' }) {
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw new HttpError(400, 'Некорректный ID записи');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Оценка должна быть от 1 до 5');
  if (!['website', 'telegram'].includes(source)) throw new HttpError(400, 'Некорректный источник отзыва');

  const booking = await getOwnedAttendedBooking(bookingId, clientPhone);
  const normalizedComment = String(comment || '').trim().slice(0, 500);

  try {
    const result = await database.one(`
      INSERT INTO barber_reviews (booking_id, barber_id, client_phone, rating, comment, source)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [booking.id, booking.barberId, normalizePhone(clientPhone), rating, normalizedComment, source]);
    return { id: Number(result.id), bookingId: booking.id, rating, comment: normalizedComment, source };
  } catch (error) {
    if (error?.code === '23505' || String(error?.message).includes('UNIQUE constraint failed: barber_reviews.booking_id')) {
      throw new HttpError(409, 'Отзыв к этой записи уже оставлен');
    }
    throw error;
  }
}

export async function updateTelegramReviewComment({ bookingId, clientPhone, comment }) {
  await getOwnedAttendedBooking(bookingId, clientPhone);
  const normalizedComment = String(comment || '').trim().slice(0, 500);
  if (!normalizedComment) throw new HttpError(400, 'Комментарий не может быть пустым');

  const result = await database.run(`
    UPDATE barber_reviews
    SET comment = ?
    WHERE booking_id = ? AND client_phone = ? AND source = 'telegram'
  `, [normalizedComment, bookingId, normalizePhone(clientPhone)]);
  if (!result.changes) throw new HttpError(404, 'Отзыв не найден');
  return { bookingId, comment: normalizedComment };
}
