import { Router } from 'express';
import { db } from '../db/connection.js';
import { validatePayload } from '../utils/validation.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/barbers');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `barber-${req.params.id}-${Date.now()}${ext}`);
  },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только JPEG, PNG и WebP файлы'));
    }
  },
});

const router = Router();

// GET all barbers (including inactive)
router.get('/', (req, res) => {
  const barbers = db
    .prepare(`
      SELECT id, name, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive
      FROM barbers
      ORDER BY sort_order ASC
    `)
    .all();
  res.json(barbers);
});

// POST create barber
router.post('/', (req, res, next) => {
  try {
    const schema = {
      name: { required: true, type: 'string' },
      photoUrl: { required: false, type: 'string' },
      sortOrder: { required: true, type: 'integer' },
    };
    validatePayload(schema, req.body);
    const { name, photoUrl = '', sortOrder } = req.body;
    const stmt = db.prepare(
      `INSERT INTO barbers (name, photo_url, sort_order, is_active) VALUES (?, ?, ?, 1)`
    );
    const info = stmt.run(name, photoUrl, sortOrder);
    const newBarber = db
      .prepare(`SELECT id, name, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive FROM barbers WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json(newBarber);
  } catch (err) {
    next(err);
  }
});

// PUT update barber
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = {
      name: { required: false, type: 'string' },
      photoUrl: { required: false, type: 'string' },
      sortOrder: { required: false, type: 'integer' },
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
    if (req.body.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(req.body.sortOrder);
    }
    if (req.body.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(req.body.isActive);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    const stmt = db.prepare(`UPDATE barbers SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values, id);
    const updated = db
      .prepare(`SELECT id, name, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive FROM barbers WHERE id = ?`)
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
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM bookings WHERE barber_id = ?').get(id);
    if (row.cnt === 0) {
      db.prepare('DELETE FROM barbers WHERE id = ?').run(id);
      res.json({ deleted: true });
    } else {
      db.prepare('UPDATE barbers SET is_active = 0 WHERE id = ?').run(id);
      res.json({ deleted: false, archived: true, reason: 'Есть связанные записи' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /:id/photo — upload barber photo
router.post('/:id/photo', (req, res, next) => {
  upload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      const err = new Error(uploadErr.message);
      err.status = 400;
      return next(err);
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не выбран' });
    }
    try {
      // Get old photo path to delete
      const barber = db.prepare('SELECT photo_url FROM barbers WHERE id = ?').get(req.params.id);
      if (barber && barber.photo_url && barber.photo_url.startsWith('/uploads/barbers/')) {
        const oldPath = path.resolve(__dirname, '../..', barber.photo_url.slice(1));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      const photoUrl = `/uploads/barbers/${req.file.filename}`;
      db.prepare('UPDATE barbers SET photo_url = ? WHERE id = ?').run(photoUrl, req.params.id);
      const updated = db
        .prepare('SELECT id, name, photo_url AS photoUrl, sort_order AS sortOrder, is_active AS isActive FROM barbers WHERE id = ?')
        .get(req.params.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });
});

export default router;
