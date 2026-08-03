import { db } from '../db/connection.js';
import { addMinutesToDateTime, overlaps, parseDateTimeParam } from '../utils/datetime.js';
import { HttpError } from '../utils/httpError.js';

function mapBooking(row) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    createdAt: row.createdAt,
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

function findOverlappingBooking(startsAt, endsAt) {
  return db
    .prepare(
      `
      SELECT id
      FROM bookings
      WHERE status = 'confirmed'
        AND starts_at < ?
        AND ends_at > ?
      LIMIT 1
    `,
    )
    .get(endsAt, startsAt);
}

const insertBooking = db.prepare(`
  INSERT INTO bookings (service_id, client_name, client_phone, starts_at, ends_at, status)
  VALUES (@serviceId, @clientName, @clientPhone, @startsAt, @endsAt, 'confirmed')
`);

const selectBookingById = db.prepare(`
  SELECT
    b.id,
    b.service_id AS serviceId,
    s.name AS serviceName,
    b.client_name AS clientName,
    b.client_phone AS clientPhone,
    b.starts_at AS startsAt,
    b.ends_at AS endsAt,
    b.status,
    b.created_at AS createdAt
  FROM bookings b
  JOIN services s ON s.id = b.service_id
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
        b.client_name AS clientName,
        b.client_phone AS clientPhone,
        b.starts_at AS startsAt,
        b.ends_at AS endsAt,
        b.status,
        b.created_at AS createdAt
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      ORDER BY b.starts_at ASC
    `,
    )
    .all();

  return rows.map(mapBooking);
}

export function createBooking({ serviceId, startsAt, clientName, clientPhone }) {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new HttpError(400, 'serviceId must be a positive integer');
  }

  const normalizedStartsAt = parseDateTimeParam(startsAt);
  if (!normalizedStartsAt) {
    throw new HttpError(400, 'startsAt must be in YYYY-MM-DDTHH:mm:ss format');
  }

  const trimmedName = clientName?.trim();
  if (!trimmedName) {
    throw new HttpError(400, 'clientName is required');
  }

  const trimmedPhone = clientPhone?.trim();
  if (!trimmedPhone) {
    throw new HttpError(400, 'clientPhone is required');
  }

  const service = getActiveService(serviceId);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }

  const endsAt = addMinutesToDateTime(normalizedStartsAt, service.durationMinutes);
  if (!endsAt) {
    throw new HttpError(400, 'Invalid startsAt value');
  }

  const create = db.transaction(() => {
    const conflict = findOverlappingBooking(normalizedStartsAt, endsAt);
    if (conflict) {
      throw new HttpError(409, 'Selected time slot is no longer available');
    }

    const result = insertBooking.run({
      serviceId,
      clientName: trimmedName,
      clientPhone: trimmedPhone,
      startsAt: normalizedStartsAt,
      endsAt,
    });

    return selectBookingById.get(result.lastInsertRowid);
  });

  return mapBooking(create());
}
