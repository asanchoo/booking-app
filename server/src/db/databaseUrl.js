export function getDatabaseUrl() {
  return String(
    process.env.DATABASE_URL
    || process.env.STORAGE_URL
    || process.env.POSTGRES_URL
    || '',
  ).trim();
}
