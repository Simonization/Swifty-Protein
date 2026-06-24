// Lazily-created Postgres connection pool. Only instantiated when something
// actually queries (so the in-memory path never opens a connection).
import pg from 'pg';
import { config } from '../config.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
