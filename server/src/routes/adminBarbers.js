import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { database } from '../db/database.js';
import { validatePayload } from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';
import { barberPhotoUpload, replaceBarberPhoto } from '../services/barberPhotoService.js';

const router = Router();

// GET all barbers (including inactive)
router.get('/', async (req, res, next) => {
  try {
    const barbers = await database.all(`
      SELECT b.id, b.name, b.specialty, b.photo_url AS photoUrl, b.sort_order AS sortOrder, b.is_active AS isActive,
        ba.username AS accountUsername, ROUND(COALESCE(AVG(r.rating), 5), 2) AS rating,
        COUNT(r.id) AS reviewCount
      FROM barbers b
      LEFT JOIN barber_accounts ba ON ba.barber_id = b.id
      LEFT JOIN barber_reviews r ON r.barber_id = b.id
      GROUP BY b.id, ba.username
      ORDER BY b.sort_order ASC
    `);
    res.json(barbers.map((barber) => ({ ...barber, reviewCount: Number(barber.reviewCount) })));
  } catch (error) { next(error); }
});

router.get('/time-blocks', async (req, res, next) => {
  try {
    const blocks = await database.all(`
      SELECT mtb.id, mtb.master_id AS masterId, b.name AS masterName,
        mtb.starts_at AS startsAt, mtb.ends_at AS endsAt, mtb.reason
      FROM master_time_blocks mtb
      JOIN barbers b ON b.id = mtb.master_id
      ORDER BY mtb.starts_at ASC
    `);
    return res.json(blocks);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/account', async (req, res, next) => {
  try {
    const barberId = Number.parseInt(req.params.id, 10);
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!Number.isInteger(barberId) || barberId <= 0) return res.status(400).json({ error: 'Некорректный ID мастера' });
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Логин: 3–32 символа, только латиница, цифры, точка, дефис или подчёркивание' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
    const barber = await database.one('SELECT id FROM barbers WHERE id = ?', [barberId]);
    if (!barber) return res.status(404).json({ error: 'Мастер не найден' });

    const passwordHash = await bcrypt.hash(password, 12);
    await database.run(`
      INSERT INTO barber_accounts (barber_id, username, password_hash)
      VALUES (?, ?, ?)
      ON CONFLICT(barber_id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash
    `, [barberId, username, passwordHash]);
    return res.status(201).json({ success: true, username });
  } catch (error) {
    if (error?.code === '23505' || String(error?.message).includes('UNIQUE constraint failed: barber_accounts.username')) {
      return res.status(409).json({ error: 'Этот логин уже занят' });
    }
    return next(error);
  }
});

// POST create barber
router.post('/', async (req, res, next) => {
  try {
    const schema = {
      name: { required: true, type: 'string' },
      photoUrl: { required: false, type: 'string' },
      specialty: { required: false, type: 'string' },
    };
    validatePayload(schema, req.body);
    const { name, photoUrl = '', specialty = 'Мастер салона' } = req.body;
    const nextOrder = await database.one('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM barbers');
    const info = await database.one('INSERT INTO barbers (name, specialty, photo_url, sort_order, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id', [name, specialty.trim() || 'Мастер салона', photoUrl, Number(nextOrder.value)]);
    const newBarber = await database.one(`SELECT id, name, specialty, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive FROM barbers WHERE id = ?`, [info.id]);
    res.status(201).json(newBarber);
  } catch (err) {
    next(err);
  }
});

// PUT update barber
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = {
      name: { required: false, type: 'string' },
      photoUrl: { required: false, type: 'string' },
      specialty: { required: false, type: 'string' },
      isActive: { required: false, type: 'integer' },
    };
    validatePayload(schema, req.body);
    const fields = [];
    const values = [];
    if (req.body.name !== undefined) {
      fields.push('name = ?');
      values.push(req.body.name);
    }
    if (req.body.photoUrl !== undefined) {
      fields.push('photo_url = ?');
      values.push(req.body.photoUrl);
    }
    if (req.body.specialty !== undefined) {
      fields.push('specialty = ?');
      values.push(req.body.specialty.trim() || 'Мастер салона');
    }
    if (req.body.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(req.body.isActive);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    await database.run(`UPDATE barbers SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    const updated = await database.one(`SELECT id, name, specialty, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive FROM barbers WHERE id = ?`, [id]);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE — smart delete: physical if no bookings, soft if bookings exist
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await database.one('SELECT COUNT(*) AS cnt FROM bookings WHERE barber_id = ?', [id]);
    if (Number(row.cnt) === 0) {
      await database.run('DELETE FROM barbers WHERE id = ?', [id]);
      res.json({ deleted: true });
    } else {
      await database.run('UPDATE barbers SET is_active = 0 WHERE id = ?', [id]);
      res.json({ deleted: false, archived: true, reason: 'Есть связанные записи' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /:id/photo — upload barber photo
router.post('/:id/photo', (req, res, next) => {
  barberPhotoUpload.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const err = new HttpError(400, uploadErr.message);
      return next(err);
    }
    try {
      return res.json(await replaceBarberPhoto({ barberId: req.params.id, file: req.file }));
    } catch (err) {
      return next(err);
    }
  });
});

export default router;
