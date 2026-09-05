import { Router } from 'express';
import { database, transaction } from '../db/database.js';
import { validatePayload } from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

async function normalizeMasterIds(masterIds, client = database) {
  if (!Array.isArray(masterIds) || masterIds.length === 0) throw new HttpError(400, 'Выберите хотя бы одного мастера');
  const ids = [...new Set(masterIds.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new HttpError(400, 'Некорректный список мастеров');
  const placeholders = ids.map(() => '?').join(', ');
  const count = Number((await client.one(`SELECT COUNT(*) AS count FROM barbers WHERE id IN (${placeholders}) AND is_active = 1`, ids)).count);
  if (count !== ids.length) throw new HttpError(400, 'Можно выбрать только активных мастеров');
  return ids;
}

async function replaceServiceMasters(serviceId, masterIds, client = database) {
  await client.run('DELETE FROM service_masters WHERE service_id = ?', [serviceId]);
  for (const masterId of masterIds) {
    await client.run('INSERT INTO service_masters (service_id, master_id) VALUES (?, ?)', [serviceId, masterId]);
  }
}

async function getService(serviceId, client = database) {
  const service = await client.one(`SELECT id, name, description, duration_minutes AS durationMinutes, price_cents AS priceCents, is_active AS isActive, created_at AS createdAt FROM services WHERE id = ?`, [serviceId]);
  if (!service) return null;
  service.masters = await client.all(`SELECT b.id, b.name FROM service_masters sm JOIN barbers b ON b.id = sm.master_id WHERE sm.service_id = ? ORDER BY b.sort_order ASC, b.name ASC`, [serviceId]);
  service.masterIds = service.masters.map((master) => master.id);
  return service;
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await database.all('SELECT id FROM services ORDER BY id ASC');
    res.json(await Promise.all(rows.map(({ id }) => getService(id))));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    validatePayload({ name: { required: true, type: 'string' }, description: { required: false, type: 'string' }, durationMinutes: { required: true, type: 'integer' }, priceCents: { required: true, type: 'integer' } }, req.body);
    const masterIds = await normalizeMasterIds(req.body.masterIds);
    if (Number(req.body.durationMinutes) < 1 || Number(req.body.durationMinutes) > 1440) throw new HttpError(400, 'Длительность должна быть от 1 до 1440 минут');
    const name = req.body.name.trim();
    const description = (req.body.description || '').trim();
    if (!name) throw new HttpError(400, 'Название услуги обязательно');
    if (description.length > 500) throw new HttpError(400, 'Описание не должно быть длиннее 500 символов');
    const serviceId = await transaction(async (client) => {
      const info = await client.one('INSERT INTO services (name, description, duration_minutes, price_cents, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id', [name, description, req.body.durationMinutes, req.body.priceCents]);
      await replaceServiceMasters(info.id, masterIds, client);
      return info.id;
    });
    res.status(201).json(await getService(serviceId));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const serviceId = Number(req.params.id);
    if (!Number.isInteger(serviceId) || serviceId <= 0 || !await getService(serviceId)) throw new HttpError(404, 'Услуга не найдена');
    validatePayload({ name: { required: false, type: 'string' }, description: { required: false, type: 'string' }, durationMinutes: { required: false, type: 'integer' }, priceCents: { required: false, type: 'integer' }, isActive: { required: false, type: 'integer' } }, req.body);
    const fields = [], values = [];
    if (req.body.durationMinutes !== undefined && (Number(req.body.durationMinutes) < 1 || Number(req.body.durationMinutes) > 1440)) throw new HttpError(400, 'Длительность должна быть от 1 до 1440 минут');
    if (req.body.isActive !== undefined && ![0, 1].includes(req.body.isActive)) throw new HttpError(400, 'Некорректный статус услуги');
    if (req.body.name !== undefined) { const name = req.body.name.trim(); if (!name) throw new HttpError(400, 'Название услуги обязательно'); fields.push('name = ?'); values.push(name); }
    if (req.body.description !== undefined) { const description = req.body.description.trim(); if (description.length > 500) throw new HttpError(400, 'Описание не должно быть длиннее 500 символов'); fields.push('description = ?'); values.push(description); }
    if (req.body.durationMinutes !== undefined) { fields.push('duration_minutes = ?'); values.push(req.body.durationMinutes); }
    if (req.body.priceCents !== undefined) { fields.push('price_cents = ?'); values.push(req.body.priceCents); }
    if (req.body.isActive !== undefined) { fields.push('is_active = ?'); values.push(req.body.isActive); }
    const masterIds = req.body.masterIds === undefined ? null : await normalizeMasterIds(req.body.masterIds);
    if (!fields.length && !masterIds) throw new HttpError(400, 'Нет полей для обновления');
    await transaction(async (client) => {
      if (fields.length) await client.run(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, [...values, serviceId]);
      if (masterIds) await replaceServiceMasters(serviceId, masterIds, client);
    });
    res.json(await getService(serviceId));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await database.one('SELECT COUNT(*) AS cnt FROM bookings WHERE service_id = ?', [id]);
    if (Number(row.cnt) === 0) { await database.run('DELETE FROM services WHERE id = ?', [id]); res.json({ deleted: true }); }
    else { await database.run('UPDATE services SET is_active = 0 WHERE id = ?', [id]); res.json({ deleted: false, archived: true, reason: 'Есть связанные записи' }); }
  } catch (err) { next(err); }
});

export default router;
