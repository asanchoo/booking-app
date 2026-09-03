import { db } from '../db/connection.js';
import { getAvailableSlots } from './slotService.js';
import { HttpError } from '../utils/httpError.js';

const pad = (value) => String(value).padStart(2, '0');
export const toDateString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function listAiServices() {
  return db.prepare(`
    SELECT id, name, description, duration_minutes AS durationMinutes,
      price_cents AS priceCents
    FROM services
    WHERE is_active = 1
    ORDER BY id ASC
  `).all();
}

export function listAiMasters(serviceId) {
  const id = Number(serviceId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Некорректная услуга');
  return db.prepare(`
    SELECT master.id, master.name,
      ROUND(COALESCE(AVG(review.rating), 5), 2) AS rating,
      COUNT(review.id) AS reviewCount
    FROM service_masters relation
    JOIN barbers master ON master.id = relation.master_id AND master.is_active = 1
    LEFT JOIN barber_reviews review ON review.barber_id = master.id
    WHERE relation.service_id = ?
    GROUP BY master.id
    ORDER BY master.sort_order ASC, master.name ASC
  `).all(id);
}

export function findAiSlots({ serviceId, masterId, dateFrom, dateTo, limit = 8 }) {
  const service = Number(serviceId);
  const master = Number(masterId);
  if (!Number.isInteger(service) || !Number.isInteger(master)) throw new HttpError(400, 'Выберите услугу и мастера');
  const from = dateFrom || toDateString();
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 7);
  const to = dateTo || dateFrom || toDateString(defaultEnd);
  const result = getAvailableSlots(service, master, from, to);
  const now = Date.now();
  return (Array.isArray(result?.slots) ? result.slots : [])
    .filter((slot) => new Date(slot.startsAt || slot.start_time).getTime() > now)
    .slice(0, Math.min(Math.max(Number(limit) || 8, 1), 48));
}

export function executeAiTool(name, args = {}) {
  if (name === 'list_services') return listAiServices().map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceTenge: service.priceCents / 100,
    currency: 'KZT',
    priceFormatted: `${(service.priceCents / 100).toLocaleString('ru-RU')} ₸`,
  }));
  if (name === 'list_masters') return listAiMasters(args.service_id);
  if (name === 'find_available_slots') return findAiSlots({
    serviceId: args.service_id,
    masterId: args.master_id,
    dateFrom: args.date_from,
    dateTo: args.date_to,
    limit: args.limit,
  });
  throw new HttpError(400, `Неизвестный AI-инструмент: ${name}`);
}
