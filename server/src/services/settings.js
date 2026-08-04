import { db } from '../db/connection.js';

let cachedSettings = null;

export function clearCache() {
  cachedSettings = null;
}

export function getBusinessSettings() {
  const rows = db.prepare('SELECT key, value FROM business_settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function getWorkDays(settings = getBusinessSettings()) {
  return settings.work_days.split(',').map((day) => Number(day.trim()));
}

