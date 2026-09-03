import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const telegramPkg = require('node-telegram-bot-api');
const { Bot } = telegramPkg;

import { db } from '../db/connection.js';
import { listClientBookings, cancelBooking, rescheduleBooking } from './bookingService.js';
import { getAvailableSlots } from './slotService.js';
import { normalizePhone } from '../utils/phone.js';
import { createMasterReview, updateTelegramReviewComment } from './reviewService.js';
import { createTelegramLoginLink } from './telegramLoginService.js';

let botInstance = null;

// In-memory cache for proposed reschedule slots per booking
const pendingReschedules = new Map();
const pendingReviewComments = new Map();

function getLinkedPhone(chatId) {
  return db.prepare('SELECT phone FROM telegram_links WHERE chat_id = ?').get(chatId)?.phone || null;
}

function getOwnedBooking(chatId, bookingId) {
  const phone = getLinkedPhone(chatId);
  if (!phone) return null;
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  return booking && normalizePhone(booking.client_phone) === normalizePhone(phone) ? booking : null;
}

export function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not configured in .env');
    return;
  }

  if (botInstance) return botInstance;

  botInstance = new Bot(token);
  console.log('[TelegramBot] Bot initialized.');

  // Helper to format date & time for display
  const formatDateTimeDisplay = (isoString) => {
    if (!isoString) return { dateStr: '', timeStr: '' };
    const dateObj = new Date(isoString);
    const dateStr = dateObj.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
    const timeStr = dateObj.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { dateStr, timeStr };
  };

  const linkedMenu = (chatId) => {
    const rows = [[{ text: '📅 Мои записи', callback_data: 'show_my_bookings' }]];
    try {
      rows.push([{ text: '🔐 Открыть личный кабинет', url: createTelegramLoginLink(chatId) }]);
    } catch { /* A Telegram link can exist before the client creates an account. */ }
    return { inline_keyboard: rows };
  };

  // Helper to fetch 3 nearest available slots
  const getNearestThreeSlots = (serviceId, barberId) => {
    const today = new Date();
    const y1 = today.getFullYear();
    const m1 = String(today.getMonth() + 1).padStart(2, '0');
    const d1 = String(today.getDate()).padStart(2, '0');
    const fromStr = `${y1}-${m1}-${d1}`;

    const end = new Date(today.getTime() + 7 * 86400 * 1000);
    const y2 = end.getFullYear();
    const m2 = String(end.getMonth() + 1).padStart(2, '0');
    const d2 = String(end.getDate()).padStart(2, '0');
    const toStr = `${y2}-${m2}-${d2}`;

    const res = getAvailableSlots(serviceId, barberId, fromStr, toStr);
    const allSlots = Array.isArray(res?.slots) ? res.slots : [];
    const nowIso = new Date().toISOString();
    const futureSlots = allSlots.filter((s) => (s.startsAt || s.start_time) > nowIso);
    return futureSlots.slice(0, 3);
  };

  // Helper to show upcoming bookings
  async function showMyBookings(chatId) {
    const link = db.prepare(`SELECT phone FROM telegram_links WHERE chat_id = ?`).get(chatId);

    if (!link) {
      return sendTelegramMessage(
        chatId,
        '⚠️ Ваш Telegram еще не привязан к номеру телефона. Войдите на сайт или оформите запись, затем нажмите "Привязать Telegram".'
      );
    }

    const bookings = listClientBookings(link.phone);
    const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.startsAt) >= new Date());

    if (upcoming.length === 0) {
      return sendTelegramMessage(chatId, 'У вас нет предстоящих записей.');
    }

    for (const b of upcoming) {
      const { dateStr, timeStr } = formatDateTimeDisplay(b.startsAt);
      const textMsg = `💈 *${b.serviceName}*\n📅 Дата: ${dateStr}\n⏰ Время: ${timeStr}\n✂️ Мастер: ${b.barberName || 'Не указан'}`;

      await sendTelegramMessage(chatId, textMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Перенести', callback_data: `resched_slots_${b.id}` },
              { text: '❌ Отменить', callback_data: `cancel_ask_${b.id}` },
            ],
          ],
        },
      });
    }
  }

  // Helper to render slots choice menu for reschedule
  async function renderRescheduleSlotsMenu(chatId, messageId, bookingId, customPrefixText = '') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!getOwnedBooking(chatId, bookingId)) {
      return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '❌ Запись не найдена или принадлежит другому клиенту.' }),
      }).catch(() => {});
    }
    const booking = db.prepare(`
      SELECT b.id, b.service_id, b.barber_id, s.name as service_name, barb.name as barber_name
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      LEFT JOIN barbers barb ON b.barber_id = barb.id
      WHERE b.id = ?
    `).get(bookingId);

    if (!booking) {
      return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: '❌ Запись не найдена.',
        }),
      }).catch(() => {});
    }

    const topSlots = getNearestThreeSlots(booking.service_id, booking.barber_id);
    pendingReschedules.set(bookingId, topSlots);

    if (topSlots.length === 0) {
      return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: 'К сожалению, нет доступных слотов для переноса.',
          reply_markup: {
            inline_keyboard: [
              [{ text: '↩️ Назад', callback_data: `cancel_back_${bookingId}` }],
            ],
          },
        }),
      }).catch(() => {});
    }

    const slotButtons = topSlots.map((s, idx) => {
      const { dateStr, timeStr } = formatDateTimeDisplay(s.startsAt);
      return [{ text: `📅 ${dateStr}, ${timeStr}`, callback_data: `resched_ask_${bookingId}_${idx}` }];
    });

    slotButtons.push([{ text: '↩️ Назад', callback_data: `cancel_back_${bookingId}` }]);

    const headerText = customPrefixText
      ? `${customPrefixText}\n\nВыберите новое время для записи на ${booking.service_name} к ${booking.barber_name || 'мастеру'}:`
      : `Выберите новое время для записи на ${booking.service_name} к ${booking.barber_name || 'мастеру'}:`;

    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: headerText,
        reply_markup: { inline_keyboard: slotButtons },
      }),
    }).catch(() => {});
  }

  // Handle /start code or /start
  botInstance.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/);
    const startParam = parts.length > 1 ? parts[1].trim() : null;

    if (startParam) {
      const nowIso = new Date().toISOString();
      const linkRecord = db
        .prepare(`SELECT code, phone, expires_at FROM telegram_linking_codes WHERE code = ? AND expires_at > ?`)
        .get(startParam, nowIso);

      if (!linkRecord) {
        return sendTelegramMessage(
          chatId,
          '❌ Ссылка для привязки недействительна или истёк её срок действия (10 минут). Попробуйте сгенерировать новую ссылку на сайте.'
        );
      }

      const cleanPhone = normalizePhone(linkRecord.phone);
      db.prepare(`INSERT OR REPLACE INTO telegram_links (phone, chat_id) VALUES (?, ?)`).run(cleanPhone, chatId);
      db.prepare(`DELETE FROM telegram_linking_codes WHERE code = ?`).run(startParam);

      return sendTelegramMessage(
        chatId,
        '✅ Telegram успешно привязан! Теперь вы будете получать уведомления о записях. Если вы уже создали аккаунт на сайте, личный кабинет откроется без пароля.',
        {
          reply_markup: linkedMenu(chatId),
        }
      );
    }

    const link = db.prepare(`SELECT phone FROM telegram_links WHERE chat_id = ?`).get(chatId);
    if (link) {
      return sendTelegramMessage(
        chatId,
        `Здравствуйте! 👋\n\nВы вошли в бот BarberShop. Нажмите кнопку ниже, чтобы посмотреть свои записи.`,
        {
          reply_markup: linkedMenu(chatId),
        }
      );
    } else {
      return sendTelegramMessage(
        chatId,
        'Здравствуйте! 👋 Это бот BarberShop.\n\nДля привязки номера телефона оформите запись или войдите в личный кабинет на сайте и нажмите кнопку "Привязать Telegram".'
      );
    }
  });

  // Handle "Мои записи" button text
  botInstance.hears('Мои записи', async (ctx) => {
    await showMyBookings(ctx.chat.id);
  });

  botInstance.hears('Личный кабинет', async (ctx) => {
    try {
      const url = createTelegramLoginLink(ctx.chat.id);
      await sendTelegramMessage(ctx.chat.id, 'Ссылка действует 10 минут и подходит только для одного входа.', {
        reply_markup: { inline_keyboard: [[{ text: '🔐 Открыть личный кабинет', url }]] },
      });
    } catch (error) {
      await sendTelegramMessage(ctx.chat.id, `Не удалось открыть кабинет: ${error.message}`);
    }
  });

  // The rating is saved immediately; the next regular text message can enrich it with a comment.
  botInstance.on('message', async (ctx, next) => {
    const chatId = ctx.chat?.id;
    const text = String(ctx.message?.text || '').trim();
    const pending = pendingReviewComments.get(chatId);
    if (!pending || !text || text.startsWith('/')) return next();

    if (pending.expiresAt <= Date.now()) {
      pendingReviewComments.delete(chatId);
      await sendTelegramMessage(chatId, 'Время для комментария истекло, но ваша оценка уже сохранена. Спасибо!');
      return;
    }

    const link = db.prepare('SELECT phone FROM telegram_links WHERE chat_id = ?').get(chatId);
    if (!link || normalizePhone(link.phone) !== pending.phone) {
      pendingReviewComments.delete(chatId);
      await sendTelegramMessage(chatId, 'Не удалось подтвердить аккаунт. Оценка сохранена без комментария.');
      return;
    }

    try {
      updateTelegramReviewComment({ bookingId: pending.bookingId, clientPhone: link.phone, comment: text });
      pendingReviewComments.delete(chatId);
      await sendTelegramMessage(chatId, 'Спасибо! Ваш отзыв опубликован на сайте 💛');
    } catch (error) {
      await sendTelegramMessage(chatId, `Не удалось сохранить комментарий: ${error.message || 'попробуйте позже'}`);
    }
  });

  // Handle callback queries for inline buttons
  botInstance.on('callback_query', async (ctx) => {
    const query = ctx.callbackQuery;
    const data = query?.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;

    if (!data || !chatId || !messageId) return;

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (data === 'show_my_bookings') {
      await ctx.answerCallbackQuery().catch(() => {});
      await showMyBookings(chatId);
      return;
    }

    // ─── REVIEW FLOW ────────────────────────────────────────────────────────
    if (data.startsWith('review_rate_')) {
      const match = /^review_rate_(\d+)_([1-5])$/.exec(data);
      if (!match) return;
      const bookingId = Number.parseInt(match[1], 10);
      const rating = Number.parseInt(match[2], 10);
      const link = db.prepare('SELECT phone FROM telegram_links WHERE chat_id = ?').get(chatId);

      try {
        if (!link) throw new Error('Telegram не привязан к аккаунту');
        createMasterReview({ bookingId, clientPhone: link.phone, rating, source: 'telegram' });
        pendingReviewComments.set(chatId, {
          bookingId,
          phone: normalizePhone(link.phone),
          expiresAt: Date.now() + 30 * 60 * 1000,
        });
        await ctx.answerCallbackQuery({ text: 'Оценка сохранена' }).catch(() => {});
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `${'⭐'.repeat(rating)}${'☆'.repeat(5 - rating)}\n\nОценка уже появилась на сайте. Хотите добавить комментарий? Просто отправьте его следующим сообщением.`,
            reply_markup: {
              inline_keyboard: [[{ text: 'Без комментария', callback_data: `review_skip_${bookingId}` }]],
            },
          }),
        });
      } catch (error) {
        const alreadyReviewed = error?.status === 409;
        await ctx.answerCallbackQuery({ text: alreadyReviewed ? 'Отзыв уже сохранён' : 'Не удалось сохранить оценку' }).catch(() => {});
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: alreadyReviewed ? 'Спасибо! Вы уже оставили отзыв об этом визите.' : `❌ ${error.message || 'Не удалось сохранить оценку'}`,
          }),
        }).catch(() => {});
      }
    } else if (data.startsWith('review_skip_')) {
      const bookingId = Number.parseInt(data.replace('review_skip_', ''), 10);
      const pending = pendingReviewComments.get(chatId);
      if (pending?.bookingId === bookingId) pendingReviewComments.delete(chatId);
      await ctx.answerCallbackQuery({ text: 'Спасибо за оценку!' }).catch(() => {});
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: 'Спасибо за оценку! Она уже учтена в рейтинге мастера 💛',
        }),
      }).catch(() => {});
    }

    // ─── ATTENDANCE CONFIRMATION ─────────────────────────────────────────────
    else if (data.startsWith('confirm_attend_')) {
      const bookingId = parseInt(data.replace('confirm_attend_', ''), 10);
      if (!getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }
      const nowIso = new Date().toISOString();
      db.prepare(`UPDATE bookings SET client_confirmed_at = ? WHERE id = ?`).run(nowIso, bookingId);

      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: 'Отлично, ждём вас! 🙌',
        }),
      }).catch(() => {});
    }

    // ─── CANCELLATION FLOW ──────────────────────────────────────────────────
    else if (data.startsWith('cancel_ask_')) {
      const bookingId = parseInt(data.replace('cancel_ask_', ''), 10);
      const link = db.prepare(`SELECT phone FROM telegram_links WHERE chat_id = ?`).get(chatId);
      if (!link || !getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }

      const booking = db.prepare(`
        SELECT b.id, b.starts_at, s.name as service_name, barb.name as barber_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN barbers barb ON b.barber_id = barb.id
        WHERE b.id = ?
      `).get(bookingId);

      if (!booking) {
        return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: '❌ Запись не найдена.',
          }),
        }).catch(() => {});
      }

      const { dateStr, timeStr } = formatDateTimeDisplay(booking.starts_at);
      const askText = `Вы уверены, что хотите отменить запись на ${booking.service_name} к ${booking.barber_name || 'мастеру'}, ${dateStr} ${timeStr}?`;

      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: askText,
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Да, отменить', callback_data: `cancel_confirm_${bookingId}` }],
              [{ text: '↩️ Назад', callback_data: `cancel_back_${bookingId}` }],
            ],
          },
        }),
      }).catch(() => {});
    } else if (data.startsWith('cancel_confirm_')) {
      const bookingId = parseInt(data.replace('cancel_confirm_', ''), 10);
      const link = db.prepare(`SELECT phone FROM telegram_links WHERE chat_id = ?`).get(chatId);
      if (!link || !getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }

      const success = cancelBooking(bookingId);
      if (success) {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: 'Запись отменена ✅',
          }),
        }).catch(() => {});
      } else {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: '❌ Не удалось отменить запись (возможно, она уже отменена).',
          }),
        }).catch(() => {});
      }
    } else if (data.startsWith('cancel_back_')) {
      const bookingId = parseInt(data.replace('cancel_back_', ''), 10);
      if (!getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }
      const booking = db.prepare(`
        SELECT b.id, b.starts_at, s.name as service_name, barb.name as barber_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN barbers barb ON b.barber_id = barb.id
        WHERE b.id = ?
      `).get(bookingId);

      if (booking) {
        const { dateStr, timeStr } = formatDateTimeDisplay(booking.starts_at);
        const textMsg = `💈 *${booking.service_name}*\n📅 Дата: ${dateStr}\n⏰ Время: ${timeStr}\n✂️ Мастер: ${booking.barber_name || 'Не указан'}`;

        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: textMsg,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔄 Перенести', callback_data: `resched_slots_${booking.id}` },
                  { text: '❌ Отменить', callback_data: `cancel_ask_${booking.id}` },
                ],
              ],
            },
          }),
        }).catch(() => {});
      } else {
        await showMyBookings(chatId);
      }
    }

    // ─── RESCHEDULE FLOW ────────────────────────────────────────────────────
    else if (data.startsWith('resched_slots_')) {
      const bookingId = parseInt(data.replace('resched_slots_', ''), 10);
      await renderRescheduleSlotsMenu(chatId, messageId, bookingId);
    } else if (data.startsWith('resched_ask_')) {
      // Format: resched_ask_<bookingId>_<slotIndex>
      const parts = data.split('_');
      const bookingId = parseInt(parts[2], 10);
      const slotIdx = parseInt(parts[3], 10);
      if (!getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }

      let topSlots = pendingReschedules.get(bookingId);
      if (!topSlots) {
        const booking = db.prepare('SELECT service_id, barber_id FROM bookings WHERE id = ?').get(bookingId);
        if (booking) {
          topSlots = getNearestThreeSlots(booking.service_id, booking.barber_id);
          pendingReschedules.set(bookingId, topSlots);
        }
      }

      const selectedSlot = topSlots ? topSlots[slotIdx] : null;
      if (!selectedSlot) {
        return renderRescheduleSlotsMenu(chatId, messageId, bookingId, '⚠️ Слот не найден.');
      }

      const booking = db.prepare(`
        SELECT b.id, s.name as service_name, barb.name as barber_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN barbers barb ON b.barber_id = barb.id
        WHERE b.id = ?
      `).get(bookingId);

      const slotStartsAt = selectedSlot.startsAt || selectedSlot.start_time;
      const { dateStr, timeStr } = formatDateTimeDisplay(slotStartsAt);

      const confirmText = `Перенести запись на ${booking?.service_name || 'услугу'} к ${booking?.barber_name || 'мастеру'} на ${dateStr} ${timeStr}?`;

      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: confirmText,
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Да, перенести', callback_data: `resched_do_${bookingId}_${slotIdx}` }],
              [{ text: '↩️ Назад', callback_data: `resched_slots_${bookingId}` }],
            ],
          },
        }),
      }).catch(() => {});
    } else if (data.startsWith('resched_do_')) {
      // Format: resched_do_<bookingId>_<slotIndex>
      const parts = data.split('_');
      const bookingId = parseInt(parts[2], 10);
      const slotIdx = parseInt(parts[3], 10);
      if (!getOwnedBooking(chatId, bookingId)) {
        await ctx.answerCallbackQuery({ text: 'Запись не найдена' }).catch(() => {});
        return;
      }

      let topSlots = pendingReschedules.get(bookingId);
      if (!topSlots) {
        const booking = db.prepare('SELECT service_id, barber_id FROM bookings WHERE id = ?').get(bookingId);
        if (booking) {
          topSlots = getNearestThreeSlots(booking.service_id, booking.barber_id);
          pendingReschedules.set(bookingId, topSlots);
        }
      }

      const selectedSlot = topSlots ? topSlots[slotIdx] : null;
      if (!selectedSlot) {
        return renderRescheduleSlotsMenu(chatId, messageId, bookingId, '⚠️ Слот устарел, выберите заново.');
      }

      const newStartsAt = selectedSlot.startsAt || selectedSlot.start_time;

      try {
        const updated = rescheduleBooking(bookingId, newStartsAt);
        const { dateStr, timeStr } = formatDateTimeDisplay(updated.startsAt);
        pendingReschedules.delete(bookingId);

        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `Запись перенесена ✅\nНовое время: ${dateStr} в ${timeStr}`,
          }),
        }).catch(() => {});
      } catch (err) {
        if (err.status === 409) {
          return renderRescheduleSlotsMenu(
            chatId,
            messageId,
            bookingId,
            'Этот слот только что заняли, выберите другой'
          );
        } else {
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ Ошибка при переносе: ${err.message || 'Не удалось перенести запись'}`,
            }),
          }).catch(() => {});
        }
      }
    }
  });

  const mode = String(process.env.TELEGRAM_MODE || 'polling').toLowerCase();
  if (mode === 'polling') {
    botInstance.startPolling();
    console.log('[TelegramBot] Polling started successfully.');
  } else {
    console.log('[TelegramBot] Webhook mode initialized.');
  }
  return botInstance;
}

export async function processTelegramUpdate(update) {
  const bot = initBot();
  if (!bot) throw new Error('Telegram bot is not configured');
  await bot.processUpdate(update);
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured in .env');
  }

  const payload = {
    chat_id: chatId,
    text,
    ...options,
  };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error('[Telegram API] Error sending message:', data);
    throw new Error(data.description || 'Failed to send Telegram message');
  }

  return data;
}
