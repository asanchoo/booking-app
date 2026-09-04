import { database } from '../db/database.js';

let cachedSettings = null;

export function clearCache() {
  cachedSettings = null;
}

export async function getBusinessSettings() {
  const rows = await database.all('SELECT key, value FROM business_settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function getWorkDays(settings) {
  return settings.work_days.split(',').map((day) => Number(day.trim()));
}
