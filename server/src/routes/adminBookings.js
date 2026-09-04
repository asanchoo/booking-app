import { Router } from 'express';
import { database } from '../db/database.js';
import { cancelBooking, createBooking, rescheduleBooking } from '../services/bookingService.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const booking = await createBooking({ ...req.body, source: 'admin' });
    return res.status(201).json(booking);
  } catch (error) {
    return next(error);
  }
});

function getBooking(bookingId) {
  return database.one(`
    SELECT b.id, b.client_phone AS clientPhone, b.status, b.starts_at AS startsAt,
      s.name AS serviceName, master.name AS masterName
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN barbers master ON master.id = b.barber_id
    WHERE b.id = ?
  `, [bookingId]);
}

async function notifyClient(phone, text) {
  const link = await database.one('SELECT chat_id FROM telegram_links WHERE phone = ?', [phone]);
  if (!link?.chat_id) return false;
  try {
    await sendTelegramMessage(link.chat_id, text);
    return true;
  } catch (error) {
    console.error('[AdminBooking] Telegram notification failed:', error?.message);
    return false;
  }
}

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const bookingId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bookingId) || bookingId <= 0) throw new HttpError(400, 'Некорректный ID записи');
    const booking = await getBooking(bookingId);
    if (!booking) throw new HttpError(404, 'Запись не найдена');
    if (booking.status === 'cancelled') throw new HttpError(400, 'Запись уже отменена');
    if (new Date(booking.startsAt).getTime() <= Date.now()) throw new HttpError(400, 'Завершённую запись нельзя отменить');
    await cancelBooking(bookingId);
    const telegramNotified = await notifyClient(booking.clientPhone, `❌ Администратор отменил вашу запись на услугу «${booking.serviceName}» к мастеру ${booking.masterName}. Если хотите выбрать другое время, откройте личный кабинет на сайте.`);
    return res.json({ success: true, id: bookingId, status: 'cancelled', telegramNotified });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reschedule', async (req, res, next) => {
  try {
    const bookingId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bookingId) || bookingId <= 0) throw new HttpError(400, 'Некорректный ID записи');
    const booking = await getBooking(bookingId);
    if (!booking) throw new HttpError(404, 'Запись не найдена');
    if (new Date(booking.startsAt).getTime() <= Date.now()) throw new HttpError(400, 'Завершённую запись нельзя перенести');
    const updated = await rescheduleBooking(bookingId, req.body?.newStartsAt, { enforceClientPolicy: false, penalizeClient: false });
    const date = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(updated.startsAt));
    const telegramNotified = await notifyClient(booking.clientPhone, `🔄 Администратор перенёс вашу запись на услугу «${booking.serviceName}» к мастеру ${booking.masterName}.\n\nНовое время: ${date}.`);
    return res.json({ ...updated, telegramNotified });
  } catch (error) {
    return next(error);
  }
});

export default router;
