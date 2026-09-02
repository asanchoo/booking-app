import { db } from '../db/connection.js';
import { addMinutesToDateTime, overlaps, parseDateTimeParam } from '../utils/datetime.js';
import { HttpError } from '../utils/httpError.js';
import { assertBookingCanBeChanged } from '../utils/bookingPolicy.js';
import { normalizePhone } from '../utils/phone.js';
import { applyClientRatingEvent, ensureClientRating } from './clientRatingService.js';

function mapBooking(row) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    servicePriceCents: row.servicePriceCents,
    barberId: row.barberId,
    barberName: row.barberName,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    attendanceStatus: row.attendanceStatus || 'pending',
    clientRating: Number(row.clientRating ?? 5),
    createdAt: row.createdAt,
    clientConfirmedAt: row.clientConfirmedAt || row.client_confirmed_at || null,
    bookingSource: row.bookingSource || 'online',
  };
}

function getActiveService(serviceId) {
  return db
    .prepare(
      `
      SELECT id, name, duration_minutes AS durationMinutes
      FROM services
      WHERE id = ? AND is_active = 1
    `,
    )
    .get(serviceId);
}

function getActiveBarber(barberId) {
  return db
    .prepare(
      `
      SELECT id, name
      FROM barbers
      WHERE id = ? AND is_active = 1
    `,
    )
    .get(barberId);
}

function isMasterAssignedToService(serviceId, barberId) {
  return db
    .prepare('SELECT 1 FROM service_masters WHERE service_id = ? AND master_id = ?')
    .get(serviceId, barberId);
}

function findOverlappingBooking(barberId, startsAt, endsAt) {
  return db
    .prepare(
      `
      SELECT id
      FROM bookings
      WHERE status = 'confirmed'
        AND barber_id = ?
        AND starts_at < ?
        AND ends_at > ?
      LIMIT 1
    `,
    )
    .get(barberId, endsAt, startsAt);
}

function findOverlappingTimeBlock(barberId, startsAt, endsAt) {
  return db.prepare(`
    SELECT id FROM master_time_blocks
    WHERE master_id = ? AND starts_at < ? AND ends_at > ?
    LIMIT 1
  `).get(barberId, endsAt, startsAt);
}

const insertBooking = db.prepare(`
  INSERT INTO bookings (service_id, barber_id, client_name, client_phone, starts_at, ends_at, status, booking_source)
  VALUES (@serviceId, @barberId, @clientName, @clientPhone, @startsAt, @endsAt, 'confirmed', @bookingSource)
`);

const selectBookingById = db.prepare(`
  SELECT
    b.id,
    b.service_id AS serviceId,
    s.name AS serviceName,
    s.price_cents AS servicePriceCents,
    b.barber_id AS barberId,
    br.name AS barberName,
    b.client_name AS clientName,
    b.client_phone AS clientPhone,
    b.starts_at AS startsAt,
    b.ends_at AS endsAt,
    b.status,
    b.attendance_status AS attendanceStatus,
    b.created_at AS createdAt,
    b.booking_source AS bookingSource,
    COALESCE(cr.rating, 5) AS clientRating
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  LEFT JOIN barbers br ON br.id = b.barber_id
  LEFT JOIN client_ratings cr ON cr.phone = b.client_phone
  WHERE b.id = ?
`);

export function listBookings() {
  const rows = db
    .prepare(
      `
      SELECT
        b.id,
        b.service_id AS serviceId,
        s.name AS serviceName,
        s.price_cents AS servicePriceCents,
        b.barber_id AS barberId,
        br.name AS barberName,
        b.client_name AS clientName,
        b.client_phone AS clientPhone,
        b.starts_at AS startsAt,
        b.ends_at AS endsAt,
        b.status,
        b.attendance_status AS attendanceStatus,
        b.created_at AS createdAt,
        b.booking_source AS bookingSource,
        COALESCE(cr.rating, 5) AS clientRating
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      LEFT JOIN barbers br ON br.id = b.barber_id
      LEFT JOIN client_ratings cr ON cr.phone = b.client_phone
      ORDER BY b.starts_at ASC
    `,
    )
    .all();

  return rows.map(mapBooking);
}

export function listClientBookings(clientPhone) {
  // Normalize phone for comparison or search with variants (e.g. 77011234567, +7 701 123 45 67, 87011234567)
  const cleanDigits = String(clientPhone).replace(/\D/g, '');
  const last10 = cleanDigits.slice(-10);

  const rows = db
    .prepare(
      `
      SELECT
        b.id,
        b.service_id AS serviceId,
        s.name AS serviceName,
        s.price_cents AS servicePriceCents,
        s.duration_minutes AS serviceDurationMinutes,
        b.barber_id AS barberId,
        br.name AS barberName,
        br.photo_url AS barberPhotoUrl,
        b.client_name AS clientName,
        b.client_phone AS clientPhone,
        b.starts_at AS startsAt,
        b.ends_at AS endsAt,
        b.status,
        b.attendance_status AS attendanceStatus,
        b.created_at AS createdAt,
        b.booking_source AS bookingSource,
        b.client_confirmed_at AS clientConfirmedAt,
        COALESCE(cr.rating, 5) AS clientRating,
        EXISTS(SELECT 1 FROM barber_reviews review WHERE review.booking_id = b.id) AS hasReview
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      LEFT JOIN barbers br ON br.id = b.barber_id
      LEFT JOIN client_ratings cr ON cr.phone = b.client_phone
      WHERE replace(replace(replace(replace(replace(b.client_phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
         OR b.client_phone LIKE ?
      ORDER BY b.starts_at DESC
    `,
    )
    .all(`%${last10}`, `%${last10}%`);

  return rows.map((row) => ({
    ...mapBooking(row),
    servicePriceCents: row.servicePriceCents,
    serviceDurationMinutes: row.serviceDurationMinutes,
    barberPhotoUrl: row.barberPhotoUrl,
    hasReview: Boolean(row.hasReview),
  }));
}

export function createBooking({ serviceId, barberId, startsAt, clientName, clientPhone, source = 'online' }) {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new HttpError(400, 'serviceId must be a positive integer');
  }

  if (!Number.isInteger(barberId) || barberId <= 0) {
    throw new HttpError(400, 'barberId must be a positive integer');
  }

  const normalizedStartsAt = parseDateTimeParam(startsAt);
  if (!normalizedStartsAt) {
    throw new HttpError(400, 'startsAt must be in YYYY-MM-DDTHH:mm:ss format');
  }
  if (new Date(normalizedStartsAt).getTime() <= Date.now()) {
    throw new HttpError(400, 'Нельзя создать запись в прошлом');
  }
  if (!['online', 'admin'].includes(source)) {
    throw new HttpError(400, 'Некорректный источник записи');
  }

  const trimmedName = clientName?.trim();
  if (!trimmedName) {
    throw new HttpError(400, 'clientName is required');
  }

  const normalizedPhone = normalizePhone(clientPhone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new HttpError(400, 'clientPhone is required');
  }

  const service = getActiveService(serviceId);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }

  const barber = getActiveBarber(barberId);
  if (!barber) {
    throw new HttpError(400, 'Barber not found');
  }

  if (!isMasterAssignedToService(service.id, barber.id)) {
    throw new HttpError(400, 'Master is not available for selected service');
  }

  const endsAt = addMinutesToDateTime(normalizedStartsAt, service.durationMinutes);
  if (!endsAt) {
    throw new HttpError(400, 'Invalid startsAt value');
  }

  const create = db.transaction(() => {
    if (findOverlappingTimeBlock(barber.id, normalizedStartsAt, endsAt)) {
      throw new HttpError(409, 'Master is unavailable at the selected time');
    }
    const conflict = findOverlappingBooking(barber.id, normalizedStartsAt, endsAt);
    if (conflict) {
      throw new HttpError(409, 'Selected time slot is no longer available');
    }

    const result = insertBooking.run({
      serviceId,
      barberId: barber.id,
      clientName: trimmedName,
      clientPhone: normalizedPhone,
      startsAt: normalizedStartsAt,
      endsAt,
      bookingSource: source,
    });

    return selectBookingById.get(result.lastInsertRowid);
  });

  const createdBooking = mapBooking(create());
  ensureClientRating(normalizedPhone);
  return createdBooking;
}

export function cancelBooking(bookingId) {
  const result = db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(bookingId);
  return result.changes > 0;
}

export function rescheduleBooking(bookingId, newStartsAt) {
  const normalizedStartsAt = parseDateTimeParam(newStartsAt);
  if (!normalizedStartsAt) {
    throw new HttpError(400, 'newStartsAt must be in YYYY-MM-DDTHH:mm:ss format');
  }

  const booking = db
    .prepare(`
      SELECT b.id, b.service_id, b.barber_id, b.client_phone, b.starts_at, b.status, s.duration_minutes
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.id = ?
    `)
    .get(bookingId);

  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  if (booking.status === 'cancelled') {
    throw new HttpError(400, 'Cannot reschedule cancelled booking');
  }

  assertBookingCanBeChanged(booking.starts_at);

  const minutesUntilVisit = (new Date(booking.starts_at).getTime() - Date.now()) / 60_000;
  if (minutesUntilVisit < 24 * 60) {
    applyClientRatingEvent({
      phone: booking.client_phone,
      bookingId,
      eventType: 'late_reschedule',
      delta: -0.25,
    });
  }

  const duration = booking.duration_minutes || 30;
  const newEndsAt = addMinutesToDateTime(normalizedStartsAt, duration);
  if (!newEndsAt) {
    throw new HttpError(400, 'Invalid newStartsAt value');
  }

  const updateTx = db.transaction(() => {
    const conflict = db
      .prepare(`
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND barber_id = ?
          AND id != ?
          AND starts_at < ?
          AND ends_at > ?
        LIMIT 1
      `)
      .get(booking.barber_id, bookingId, newEndsAt, normalizedStartsAt);

    if (conflict) {
      throw new HttpError(409, 'Selected time slot is no longer available');
    }

    db.prepare(`
      UPDATE bookings
      SET starts_at = ?, ends_at = ?, reminder_3h_sent = 0, reminder_1h_sent = 0
      WHERE id = ?
    `).run(normalizedStartsAt, newEndsAt, bookingId);

    return selectBookingById.get(bookingId);
  });

  return mapBooking(updateTx());
}
