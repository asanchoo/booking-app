import { db } from '../db/connection.js';

let cachedSettings = null;

export function getBusinessSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }

  const rows = db.prepare('SELECT key, value FROM business_settings').all();
  cachedSettings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return cachedSettings;
}

export function getWorkDays(settings = getBusinessSettings()) {
  return settings.work_days.split(',').map((day) => Number(day.trim()));
}
