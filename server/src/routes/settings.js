import { Router } from 'express';
import { database, transaction } from '../db/database.js';
import { validatePayload } from '../utils/validation.js';
import { clearCache } from '../services/settings.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// GET settings
router.get('/', async (req, res, next) => {
  try {
    const rows = await database.all('SELECT key, value FROM business_settings');
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    // Map backend keys to camelCase for the frontend if preferred
    res.json({
      workStart: settings.work_start,
      workEnd: settings.work_end,
      slotStepMinutes: Number(settings.slot_step_minutes),
      workDays: settings.work_days,
    });
  } catch (err) {
    next(err);
  }
});

// PUT settings
router.put('/', async (req, res, next) => {
  try {
    const schema = {
      workStart: { required: true, type: 'string', regex: /^([01]\d|2[0-3]):[0-5]\d$/ },
      workEnd: { required: true, type: 'string', regex: /^([01]\d|2[0-3]):[0-5]\d$/ },
      slotStepMinutes: { required: true, type: 'integer' },
      workDays: { required: true, type: 'string', regex: /^[0-6](,[0-6])*$/ },
    };
    validatePayload(schema, req.body);

    const { workStart, workEnd, slotStepMinutes, workDays } = req.body;
    if (Number(slotStepMinutes) < 5 || Number(slotStepMinutes) > 120) throw new HttpError(400, 'Шаг записи должен быть от 5 до 120 минут');
    if (workStart >= workEnd) throw new HttpError(400, 'Время окончания работы должно быть позже времени начала');
    if (new Set(workDays.split(',')).size !== workDays.split(',').length) throw new HttpError(400, 'Рабочие дни не должны повторяться');

    await transaction(async (client) => {
      const upsert = (key, value) => client.run(`
        INSERT INTO business_settings (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = excluded.value
      `, [key, value]);
      await upsert('work_start', workStart);
      await upsert('work_end', workEnd);
      await upsert('slot_step_minutes', String(slotStepMinutes));
      await upsert('work_days', workDays);
    });

    // Clear settings cache to apply changes immediately
    clearCache();

    res.json({
      workStart,
      workEnd,
      slotStepMinutes,
      workDays,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
