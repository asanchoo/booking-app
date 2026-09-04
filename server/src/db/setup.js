const target = String(process.env.DATABASE_URL || '').trim()
  ? './migratePostgres.js'
  : './migrate.js';

await import(target);
