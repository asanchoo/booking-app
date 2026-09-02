import { Router } from 'express';
import { db } from '../db/connection.js';
import { validatePayload } from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

function normalizeMasterIds(masterIds) {
  if (!Array.isArray(masterIds) || masterIds.length === 0) throw new HttpError(400, 'Выберите хотя бы одного мастера');
  const ids = [...new Set(masterIds.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new HttpError(400, 'Некорректный список мастеров');
  const placeholders = ids.map(() => '?').join(', ');
  const count = db.prepare(`SELECT COUNT(*) AS count FROM barbers WHERE id IN (${placeholders}) AND is_active = 1`).get(...ids).count;
  if (count !== ids.length) throw new HttpError(400, 'Можно выбрать только активных мастеров');
  return ids;
}

function replaceServiceMasters(serviceId, masterIds) {
  db.prepare('DELETE FROM service_masters WHERE service_id = ?').run(serviceId);
  const insert = db.prepare('INSERT INTO service_masters (service_id, master_id) VALUES (?, ?)');
  masterIds.forEach((masterId) => insert.run(serviceId, masterId));
}

function getService(serviceId) {
  const service = db.prepare(`SELECT id, name, description, duration_minutes AS durationMinutes, price_cents AS priceCents, is_active AS isActive, created_at AS createdAt FROM services WHERE id = ?`).get(serviceId);
  if (!service) return null;
  service.masters = db.prepare(`SELECT b.id, b.name FROM service_masters sm JOIN barbers b ON b.id = sm.master_id WHERE sm.service_id = ? ORDER BY b.sort_order ASC, b.name ASC`).all(serviceId);
  service.masterIds = service.masters.map((master) => master.id);
  return service;
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT id FROM services ORDER BY id ASC').all().map(({ id }) => getService(id)));
});

router.post('/', (req, res, next) => {
  try {
    validatePayload({ name: { required: true, type: 'string' }, description: { required: false, type: 'string' }, durationMinutes: { required: true, type: 'integer' }, priceCents: { required: true, type: 'integer' } }, req.body);
    const masterIds = normalizeMasterIds(req.body.masterIds);
    const name = req.body.name.trim();
    const description = (req.body.description || '').trim();
    if (!name) throw new HttpError(400, 'Название услуги обязательно');
    if (description.length > 500) throw new HttpError(400, 'Описание не должно быть длиннее 500 символов');
    const create = db.transaction(() => {
      const info = db.prepare('INSERT INTO services (name, description, duration_minutes, price_cents, is_active) VALUES (?, ?, ?, ?, 1)').run(name, description, req.body.durationMinutes, req.body.priceCents);
      replaceServiceMasters(info.lastInsertRowid, masterIds);
      return info.lastInsertRowid;
    });
    res.status(201).json(getService(create()));
  } catch (err) { next(err); }
});

router.put('/:id', (req, res, next) => {
  try {
    const serviceId = Number(req.params.id);
    if (!Number.isInteger(serviceId) || serviceId <= 0 || !getService(serviceId)) throw new HttpError(404, 'Услуга не найдена');
    validatePayload({ name: { required: false, type: 'string' }, description: { required: false, type: 'string' }, durationMinutes: { required: false, type: 'integer' }, priceCents: { required: false, type: 'integer' }, isActive: { required: false, type: 'integer' } }, req.body);
    const fields = [], values = [];
    if (req.body.name !== undefined) { const name = req.body.name.trim(); if (!name) throw new HttpError(400, 'Название услуги обязательно'); fields.push('name = ?'); values.push(name); }
    if (req.body.description !== undefined) { const description = req.body.description.trim(); if (description.length > 500) throw new HttpError(400, 'Описание не должно быть длиннее 500 символов'); fields.push('description = ?'); values.push(description); }
    if (req.body.durationMinutes !== undefined) { fields.push('duration_minutes = ?'); values.push(req.body.durationMinutes); }
    if (req.body.priceCents !== undefined) { fields.push('price_cents = ?'); values.push(req.body.priceCents); }
    if (req.body.isActive !== undefined) { fields.push('is_active = ?'); values.push(req.body.isActive); }
    const masterIds = req.body.masterIds === undefined ? null : normalizeMasterIds(req.body.masterIds);
    if (!fields.length && !masterIds) throw new HttpError(400, 'Нет полей для обновления');
    db.transaction(() => {
      if (fields.length) db.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`).run(...values, serviceId);
      if (masterIds) replaceServiceMasters(serviceId, masterIds);
    })();
    res.json(getService(serviceId));
  } catch (err) { next(err); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM bookings WHERE service_id = ?').get(id);
    if (row.cnt === 0) { db.prepare('DELETE FROM services WHERE id = ?').run(id); res.json({ deleted: true }); }
    else { db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id); res.json({ deleted: false, archived: true, reason: 'Есть связанные записи' }); }
  } catch (err) { next(err); }
});

export default router;
