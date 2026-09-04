export function getDatabaseUrl() {
  const configured = String(
    process.env.DATABASE_URL
    || process.env.STORAGE_URL
    || process.env.POSTGRES_URL
    || '',
  ).trim();
  if (configured) return configured;

  // Marketplace integrations can prepend a user-selected prefix. Detect the
  // Postgres URL by protocol so STORAGE_DATABASE_URL and similar names work.
  const discovered = Object.entries(process.env).find(([name, value]) => (
    /(?:DATABASE|POSTGRES|NEON).*URL|URL.*(?:DATABASE|POSTGRES|NEON)/i.test(name)
    && /^postgres(?:ql)?:\/\//i.test(String(value || '').trim())
  ));
  return String(discovered?.[1] || '').trim();
}

export function getPostgresConnectionConfig(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
  if (sslMode === 'disable') return { connectionString: databaseUrl, ssl: false };

  if (['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    parsed.searchParams.set('sslmode', 'verify-full');
  }
  return { connectionString: parsed.toString() };
}
