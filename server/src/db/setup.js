import { getDatabaseUrl } from './databaseUrl.js';

const target = getDatabaseUrl()
  ? './migratePostgres.js'
  : './migrate.js';

await import(target);
