import { Router } from 'express';
import { db } from '../db/connection.js';
import { validatePayload } from '../utils/validation.js';
import { clearCache } from '../services/settings.js';

const router = Router();

// GET settings
router.get('/', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
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
router.put('/', (req, res, next) => {
  try {
    const schema = {
      workStart: { required: true, type: 'string', regex: /^\d{2}:\d{2}$/ },
      workEnd: { required: true, type: 'string', regex: /^\d{2}:\d{2}$/ },
      slotStepMinutes: { required: true, type: 'integer' },
      workDays: { required: true, type: 'string', regex: /^[1-7](,[1-7])*$/ },
    };
    validatePayload(schema, req.body);

    const { workStart, workEnd, slotStepMinutes, workDays } = req.body;

    const updateStmt = db.prepare('INSERT OR REPLACE INTO business_settings (key, value) VALUES (?, ?)');
    
    // Perform updates in a transaction
    const transaction = db.transaction(() => {
      updateStmt.run('work_start', workStart);
      updateStmt.run('work_end', workEnd);
      updateStmt.run('slot_step_minutes', String(slotStepMinutes));
      updateStmt.run('work_days', workDays);
    });
    transaction();

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
