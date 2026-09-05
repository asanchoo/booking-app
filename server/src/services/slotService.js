import { database } from '../db/database.js';
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

async function getActiveService(serviceId) {
  return database.one(`
      SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents
      FROM services
      WHERE id = ? AND is_active = 1
    `, [serviceId]);
}

async function getActiveBarber(barberId) {
  return database.one(`
      SELECT id, name
      FROM barbers
      WHERE id = ? AND is_active = 1
    `, [barberId]);
}

async function isMasterAssignedToService(serviceId, barberId) {
  return database.one('SELECT 1 FROM service_masters WHERE service_id = ? AND master_id = ?', [serviceId, barberId]);
}

async function getConfirmedBookings(barberId, fromDateTime, toDateTime) {
  return database.all(`
      SELECT id, starts_at AS startsAt, ends_at AS endsAt
      FROM bookings
      WHERE status = 'confirmed'
        AND barber_id = ?
        AND starts_at < ?
        AND ends_at > ?
    `, [barberId, toDateTime, fromDateTime]);
}

async function getMasterTimeBlocks(barberId, fromDateTime, toDateTime) {
  return database.all(`
    SELECT starts_at AS startsAt, ends_at AS endsAt
    FROM master_time_blocks
    WHERE master_id = ? AND starts_at < ? AND ends_at > ?
  `, [barberId, toDateTime, fromDateTime]);
}

function generateDaySlots(date, settings, durationMinutes) {
  const workDays = getWorkDays(settings);
  if (!workDays.includes(date.getDay())) {
    return [];
  }

  const stepMinutes = Number(settings.slot_step_minutes);
  const workStartMinutes = parseTimeToMinutes(settings.work_start);
  let workEndMinutes = parseTimeToMinutes(settings.work_end);

  // If work_end is earlier than or equal to work_start, it means it crosses midnight into the next day (e.g. 10:00 to 02:00)
  if (workEndMinutes <= workStartMinutes) {
    workEndMinutes += 24 * 60;
  }

  const slots = [];

  for (
    let startMinutes = workStartMinutes;
    startMinutes + durationMinutes <= workEndMinutes;
    startMinutes += stepMinutes
  ) {
    const dayOffset = Math.floor(startMinutes / (24 * 60));
    const dayMinutes = startMinutes % (24 * 60);
    const time = minutesToTime(dayMinutes);

    let slotDate = date;
    if (dayOffset > 0) {
      slotDate = addDays(date, dayOffset);
    }

    const startsAt = buildDateTime(slotDate, time);
    const endsAt = addMinutesToDateTime(startsAt, durationMinutes);
    slots.push({ startsAt, endsAt });
  }

  return slots;
}

export async function getAvailableSlots(serviceId, barberId, fromParam, toParam, excludedBookingId = null) {
  const service = await getActiveService(serviceId);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }

  const barber = await getActiveBarber(barberId);
  if (!barber) {
    throw new HttpError(404, 'Barber not found');
  }

  if (!await isMasterAssignedToService(service.id, barber.id)) {
    throw new HttpError(400, 'Master is not available for selected service');
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
  if (toDate.getTime() - fromDate.getTime() > 62 * 86400000) {
    throw new HttpError(400, 'Выберите период не больше 62 дней');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = fromDate < today ? today : fromDate;

  const settings = await getBusinessSettings();
  const now = formatDateTime(new Date());
  const overnight = parseTimeToMinutes(settings.work_end) <= parseTimeToMinutes(settings.work_start);
  const rangeEndDateTime = buildDateTime(overnight ? addDays(toDate, 1) : toDate, settings.work_end);
  const rangeStartDateTime = buildDateTime(rangeStart, settings.work_start);
  const [existingBookings, timeBlocks] = await Promise.all([
    getConfirmedBookings(barber.id, rangeStartDateTime, rangeEndDateTime),
    getMasterTimeBlocks(barber.id, rangeStartDateTime, rangeEndDateTime),
  ]);

  const slots = [];

  for (let date = new Date(rangeStart); date <= toDate; date = addDays(date, 1)) {
    const daySlots = generateDaySlots(date, settings, service.durationMinutes);

    for (const slot of daySlots) {
      if (slot.startsAt <= now) {
        continue;
      }

      const hasConflict = existingBookings.some((booking) =>
        booking.id !== excludedBookingId && overlaps(slot.startsAt, slot.endsAt, booking.startsAt, booking.endsAt),
      );

      const isBlocked = timeBlocks.some((block) =>
        overlaps(slot.startsAt, slot.endsAt, block.startsAt, block.endsAt),
      );

      if (!hasConflict && !isBlocked) {
        slots.push(slot);
      }
    }
  }

  return {
    serviceId: service.id,
    barberId: barber.id,
    from: formatDate(rangeStart),
    to: formatDate(toDate),
    slots,
  };
}
