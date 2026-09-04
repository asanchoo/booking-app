import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getDatabaseUrl } from './databaseUrl.js';

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) throw new Error('A Postgres connection URL is required for migration.');

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
