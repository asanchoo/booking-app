import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, dbPath } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db
    .prepare('SELECT name FROM schema_migrations ORDER BY name')
    .all()
    .map((row) => row.name),
);

let appliedCount = 0;

for (const file of migrationFiles) {
  if (applied.has(file)) {
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  db.exec(sql);
  db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);

  console.log(`Applied migration: ${file}`);
  appliedCount += 1;
}

if (appliedCount === 0) {
  console.log('No pending migrations.');
} else {
  console.log(`Applied ${appliedCount} migration(s).`);
}

console.log(`Database: ${dbPath}`);
