import { getDatabaseUrl } from './databaseUrl.js';

const databaseUrl = getDatabaseUrl();
if (process.env.VERCEL && !databaseUrl) {
  throw new Error('Neon Postgres URL is missing in this Vercel environment. Connect Neon to Production and Preview.');
}

const target = databaseUrl
  ? './migratePostgres.js'
  : './migrate.js';

await import(target);
