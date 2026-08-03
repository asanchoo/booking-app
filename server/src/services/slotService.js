import { db } from '../db/connection.js';
import {
  addDays,
  addMinutesToDateTime,
  buildDateTime,
  defaultSlotRange,
  formatDate,
  formatDateTime,
  overlaps,
  parseDateParam,
  parseTimeToMinutes,
  minutesToTime,
} from '../utils/datetime.js';
import { getBusinessSettings, getWorkDays } from './settings.js';
import { HttpError } from '../utils/httpError.js';

function getActiveService(serviceId) {
  return db
    .prepare(
      `
      SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents
      FROM services
      WHERE id = ? AND is_active = 1
    `,
    )
    .get(serviceId);
}

function getConfirmedBookings(fromDateTime, toDateTime) {
  return db
    .prepare(
      `
      SELECT starts_at AS startsAt, ends_at AS endsAt
      FROM bookings
      WHERE status = 'confirmed'
        AND starts_at < ?
        AND ends_at > ?
    `,
    )
    .all(toDateTime, fromDateTime);
}

function generateDaySlots(date, settings, durationMinutes) {
  const workDays = getWorkDays(settings);
  if (!workDays.includes(date.getDay())) {
    return [];
  }

  const stepMinutes = Number(settings.slot_step_minutes);
  const workStartMinutes = parseTimeToMinutes(settings.work_start);
  const workEndMinutes = parseTimeToMinutes(settings.work_end);
  const slots = [];

  for (
    let startMinutes = workStartMinutes;
    startMinutes + durationMinutes <= workEndMinutes;
    startMinutes += stepMinutes
  ) {
    const time = minutesToTime(startMinutes);
    const startsAt = buildDateTime(date, time);
    const endsAt = addMinutesToDateTime(startsAt, durationMinutes);
    slots.push({ startsAt, endsAt });
  }

  return slots;
}

export function getAvailableSlots(serviceId, fromParam, toParam) {
  const service = getActiveService(serviceId);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }

  const defaults = defaultSlotRange();
  const fromDate = fromParam ? parseDateParam(fromParam) : parseDateParam(defaults.from);
  const toDate = toParam ? parseDateParam(toParam) : parseDateParam(defaults.to);

  if (!fromDate || !toDate) {
    throw new HttpError(400, 'Invalid date format. Use YYYY-MM-DD for from and to');
  }

  if (fromDate > toDate) {
    throw new HttpError(400, 'from must be on or before to');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = fromDate < today ? today : fromDate;

  const settings = getBusinessSettings();
  const now = formatDateTime(new Date());
  const rangeEndDateTime = buildDateTime(toDate, settings.work_end);
  const rangeStartDateTime = buildDateTime(rangeStart, settings.work_start);
  const existingBookings = getConfirmedBookings(rangeStartDateTime, rangeEndDateTime);

  const slots = [];

  for (let date = new Date(rangeStart); date <= toDate; date = addDays(date, 1)) {
    const daySlots = generateDaySlots(date, settings, service.durationMinutes);

    for (const slot of daySlots) {
      if (slot.startsAt <= now) {
        continue;
      }

      const hasConflict = existingBookings.some((booking) =>
        overlaps(slot.startsAt, slot.endsAt, booking.startsAt, booking.endsAt),
      );

      if (!hasConflict) {
        slots.push(slot);
      }
    }
  }

  return {
    serviceId: service.id,
    from: formatDate(rangeStart),
    to: formatDate(toDate),
    slots,
  };
}
