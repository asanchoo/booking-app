import { Router } from 'express';
import { db } from '../db/connection.js';
import { validatePayload } from '../utils/validation.js';

const router = Router();

// GET all services (including inactive)
router.get('/', (req, res) => {
  const services = db
    .prepare(`
      SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents, is_active AS isActive, created_at AS createdAt
      FROM services
      ORDER BY id ASC
    `)
    .all();
  res.json(services);
});

// POST create service
router.post('/', (req, res, next) => {
  try {
    const schema = {
      name: { required: true, type: 'string' },
      durationMinutes: { required: true, type: 'integer' },
      priceCents: { required: true, type: 'integer' },
    };
    validatePayload(schema, req.body);
    const { name, durationMinutes, priceCents } = req.body;
    const stmt = db.prepare(
      `INSERT INTO services (name, duration_minutes, price_cents, is_active) VALUES (?, ?, ?, 1)`
    );
    const info = stmt.run(name, durationMinutes, priceCents);
    const newService = db
      .prepare(`SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents, is_active AS isActive FROM services WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json(newService);
  } catch (err) {
    next(err);
  }
});

// PUT update service
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = {
      name: { required: false, type: 'string' },
      durationMinutes: { required: false, type: 'integer' },
      priceCents: { required: false, type: 'integer' },
      isActive: { required: false, type: 'integer' },
    };
    validatePayload(schema, req.body);
    const fields = [];
    const values = [];
    if (req.body.name !== undefined) {
      fields.push('name = ?');
      values.push(req.body.name);
    }
    if (req.body.durationMinutes !== undefined) {
      fields.push('duration_minutes = ?');
      values.push(req.body.durationMinutes);
    }
    if (req.body.priceCents !== undefined) {
      fields.push('price_cents = ?');
      values.push(req.body.priceCents);
    }
    if (req.body.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(req.body.isActive);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    const stmt = db.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values, id);
    const updated = db
      .prepare(`SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents, is_active AS isActive FROM services WHERE id = ?`)
      .get(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE — smart delete: physical if no bookings, soft if bookings exist
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM bookings WHERE service_id = ?').get(id);
    if (row.cnt === 0) {
      db.prepare('DELETE FROM services WHERE id = ?').run(id);
      res.json({ deleted: true });
    } else {
      db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id);
      res.json({ deleted: false, archived: true, reason: 'Есть связанные записи' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
