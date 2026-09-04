import pg from 'pg';
import { getDatabaseUrl, getPostgresConnectionConfig } from './databaseUrl.js';

// PostgreSQL returns int8/numeric values as strings by default. All identifiers,
// counters, prices and ratings in this application stay within JavaScript's safe
// numeric range, so keep the API contract identical to the SQLite development mode.
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);

const databaseUrl = getDatabaseUrl();
export const databaseDialect = databaseUrl ? 'postgres' : 'sqlite';

const pool = databaseUrl
  ? new pg.Pool({
      ...getPostgresConnectionConfig(databaseUrl),
      max: Number(process.env.DATABASE_POOL_SIZE || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;
const sqlite = pool ? null : (await import('./connection.js')).db;

function postgresSql(sql) {
  let index = 0;
  return sql
    .replace(/\bAS\s+([a-z_]*[A-Z][A-Za-z0-9_]*)\b/g, 'AS "$1"')
    .replace(/\?/g, () => `$${++index}`);
}

function sqliteParams(params) {
  return Array.isArray(params) ? params : [params];
}

function createClient(executor, dialect) {
  return {
    dialect,

    async all(sql, params = []) {
      if (dialect === 'postgres') {
        return (await executor.query(postgresSql(sql), params)).rows;
      }
      return executor.prepare(sql).all(...sqliteParams(params));
    },

    async one(sql, params = []) {
      if (dialect === 'postgres') {
        return (await executor.query(postgresSql(sql), params)).rows[0] || null;
      }
      return executor.prepare(sql).get(...sqliteParams(params)) || null;
    },

    async run(sql, params = []) {
      if (dialect === 'postgres') {
        const result = await executor.query(postgresSql(sql), params);
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id ?? null,
          rows: result.rows,
        };
      }
      return executor.prepare(sql).run(...sqliteParams(params));
    },
  };
}

export const database = createClient(pool || sqlite, databaseDialect);

let sqliteTransactionQueue = Promise.resolve();

export async function transaction(callback) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(createClient(client, 'postgres'));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const execute = async () => {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = await callback(createClient(sqlite, 'sqlite'));
      sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  };
  const pending = sqliteTransactionQueue.then(execute, execute);
  sqliteTransactionQueue = pending.catch(() => {});
  return pending;
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
