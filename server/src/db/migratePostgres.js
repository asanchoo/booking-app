import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required for Postgres migration.');

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(here, 'postgres', 'schema.sql'), 'utf8');
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

try {
  await pool.query(schema);
  await pool.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    ['postgres_baseline_001'],
  );
  console.log('Postgres schema is up to date.');
} finally {
  await pool.end();
}
