import { db } from '../db/connection.js';
import { sendTelegramMessage } from './telegramService.js';

export async function checkAndSendReminders() {
  const stats = { reminders3h: 0, reminders1h: 0, reviewRequests: 0 };
  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Windows in milliseconds
    // 3h window: 2h50m to 3h10m (170 min to 190 min)
    const min3h = nowMs + 170 * 60 * 1000;
    const max3h = nowMs + 190 * 60 * 1000;

    // 1h window: 50m to 70m (50 min to 70 min)
    const min1h = nowMs + 50 * 60 * 1000;
    const max1h = nowMs + 70 * 60 * 1000;

    // 1. Fetch upcoming confirmed bookings that might need reminders
    const candidateBookings = db
      .prepare(`
        SELECT 
          b.id,
          b.client_phone,
          b.starts_at,
          b.reminder_3h_sent,
          b.reminder_1h_sent,
          s.name AS service_name,
          barb.name AS barber_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN barbers barb ON b.barber_id = barb.id
        WHERE b.status = 'confirmed'
          AND (b.reminder_3h_sent = 0 OR b.reminder_1h_sent = 0)
      `)
      .all();

    for (const bk of candidateBookings) {
      const startsAtDate = new Date(bk.starts_at);
      const startsAtMs = startsAtDate.getTime();
      if (isNaN(startsAtMs)) continue;

      const timeStr = startsAtDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const barberName = bk.barber_name || 'мастеру';

      // Check 3h reminder
      if (bk.reminder_3h_sent === 0 && startsAtMs >= min3h && startsAtMs <= max3h) {
        // Find telegram chat_id
        const link = db
          .prepare(`SELECT chat_id FROM telegram_links WHERE phone = ?`)
          .get(bk.client_phone);

        if (link && link.chat_id) {
          const text = `⏰ Напоминание: запись на ${bk.service_name} к ${barberName} сегодня в ${timeStr} (через 3 часа)`;
          try {
            await sendTelegramMessage(link.chat_id, text);
            stats.reminders3h += 1;
          } catch (err) {
            console.error(`[Reminder] Failed to send 3h reminder for booking #${bk.id}:`, err?.message);
          }
        }

        db.prepare(`UPDATE bookings SET reminder_3h_sent = 1 WHERE id = ?`).run(bk.id);
      }

      // Check 1h reminder
      if (bk.reminder_1h_sent === 0 && startsAtMs >= min1h && startsAtMs <= max1h) {
        // Find telegram chat_id
        const link = db
          .prepare(`SELECT chat_id FROM telegram_links WHERE phone = ?`)
          .get(bk.client_phone);

        if (link && link.chat_id) {
          const text = `⏰ Напоминание: запись на ${bk.service_name} к ${barberName} сегодня в ${timeStr} (через 1 час). Пожалуйста, подтвердите ваш визит:`;
          try {
            await sendTelegramMessage(link.chat_id, text, {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Приду', callback_data: `confirm_attend_${bk.id}` },
                    { text: '❌ Отменить запись', callback_data: `cancel_ask_${bk.id}` },
                  ],
                ],
              },
            });
            stats.reminders1h += 1;
          } catch (err) {
            console.error(`[Reminder] Failed to send 1h reminder for booking #${bk.id}:`, err?.message);
          }
        }

        db.prepare(`UPDATE bookings SET reminder_1h_sent = 1 WHERE id = ?`).run(bk.id);
      }
    }

    // Ask for feedback only after a master has confirmed the visit and the service has ended.
    // The seven-day boundary avoids messaging clients about old records after a deployment.
    const reviewCandidates = db.prepare(`
      SELECT b.id, b.client_phone, b.ends_at,
        s.name AS service_name, barb.name AS barber_name
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      JOIN barbers barb ON barb.id = b.barber_id
      WHERE b.status = 'confirmed'
        AND b.attendance_status = 'attended'
        AND b.review_request_sent_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM barber_reviews r WHERE r.booking_id = b.id)
    `).all();

    const oldestEligibleMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    for (const booking of reviewCandidates) {
      const endsAtMs = new Date(booking.ends_at).getTime();
      if (!Number.isFinite(endsAtMs) || endsAtMs > nowMs || endsAtMs < oldestEligibleMs) continue;

      const link = db.prepare('SELECT chat_id FROM telegram_links WHERE phone = ?').get(booking.client_phone);
      if (!link?.chat_id) continue;

      const text = `✨ Спасибо за визит!\n\nКак вам услуга «${booking.service_name}» у мастера ${booking.barber_name}? Оцените одним нажатием — это займёт несколько секунд.`;
      try {
        await sendTelegramMessage(link.chat_id, text, {
          reply_markup: {
            inline_keyboard: [[1, 2, 3, 4, 5].map((rating) => ({
              text: `${rating} ⭐`,
              callback_data: `review_rate_${booking.id}_${rating}`,
            }))],
          },
        });
        db.prepare(`UPDATE bookings SET review_request_sent_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), booking.id);
        stats.reviewRequests += 1;
      } catch (error) {
        console.error(`[Reminder] Failed to send review request for booking #${booking.id}:`, error?.message);
      }
    }
  } catch (err) {
    console.error('[Reminder] Error checking reminders:', err);
  }
  return stats;
}

export function initReminderCron(intervalMs = 5 * 60 * 1000) {
  console.log(`[Reminder] Initializing reminder scheduler (interval: ${intervalMs / 1000}s)...`);
  // Run once immediately on start
  checkAndSendReminders();
  // Schedule interval
  const intervalId = setInterval(checkAndSendReminders, intervalMs);
  return intervalId;
}
