import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../db/database.js';
import { HttpError } from '../utils/httpError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/barbers');
const MIME_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const useLocalDisk = !useBlob && !process.env.VERCEL;

if (useLocalDisk) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, UPLOADS_DIR),
  filename: (req, file, callback) => {
    const ownerId = req.barberId || req.params.id || 'unknown';
    const extension = MIME_EXTENSIONS.get(file.mimetype) || '';
    callback(null, `barber-${ownerId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`);
  },
});
export const barberPhotoUpload = multer({
  storage: useLocalDisk ? diskStorage : multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (MIME_EXTENSIONS.has(file.mimetype)) return callback(null, true);
    return callback(new Error('Допустимы только JPEG, PNG и WebP файлы'));
  },
});

function fileBytes(file) {
  return file.buffer || fs.readFileSync(file.path);
}

function hasValidSignature(file) {
  const bytes = fileBytes(file).subarray(0, 12);
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}

function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function replaceBarberPhoto({ barberId, file }) {
  const id = Number.parseInt(barberId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    removeFile(file?.path);
    throw new HttpError(400, 'Некорректный ID мастера');
  }
  if (!file) throw new HttpError(400, 'Файл не выбран');
  if (!hasValidSignature(file)) {
    removeFile(file.path);
    throw new HttpError(400, 'Содержимое файла не соответствует формату изображения');
  }

  const barber = await database.one('SELECT id, photo_url FROM barbers WHERE id = ? AND is_active = 1', [id]);
  if (!barber) {
    removeFile(file.path);
    throw new HttpError(404, 'Мастер не найден');
  }

  let photoUrl;
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const extension = MIME_EXTENSIONS.get(file.mimetype);
    const blob = await put(`barbers/barber-${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      addRandomSuffix: false,
    });
    photoUrl = blob.url;
  } else if (useLocalDisk) {
    photoUrl = `/uploads/barbers/${file.filename}`;
  } else {
    throw new HttpError(503, 'Хранилище фотографий временно недоступно');
  }
  await database.run('UPDATE barbers SET photo_url = ? WHERE id = ?', [photoUrl, id]);

  if (barber.photo_url?.startsWith('/uploads/barbers/')) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(barber.photo_url));
    if (oldPath !== file.path) removeFile(oldPath);
  }
  if (useBlob && /^https:\/\//.test(barber.photo_url || '')) {
    try {
      const { del } = await import('@vercel/blob');
      await del(barber.photo_url);
    } catch (error) {
      console.warn('[BarberPhoto] Old Blob cleanup failed:', error.message);
    }
  }

  return database.one('SELECT id, name, photo_url AS photoUrl FROM barbers WHERE id = ?', [id]);
}
