// Postgres-backed user store. Used when DATABASE_URL is set (Docker / prod).
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPool } from '../db/pool.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

// Run every .sql migration in order. They are idempotent (CREATE TABLE IF NOT
// EXISTS), so this is safe to call on every boot.
export async function init() {
  const pool = getPool();
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(join(migrationsDir, file), 'utf8'));
  }
}

// Column list aliased to the camelCase shape the rest of the code expects.
const COLS = 'id, username, password_hash AS "passwordHash", created_at AS "createdAt"';

export async function createUser({ username, passwordHash }) {
  const { rows } = await getPool().query(
    `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING ${COLS}`,
    [randomUUID(), username, passwordHash],
  );
  return rows[0];
}

export async function findByUsername(username) {
  const { rows } = await getPool().query(`SELECT ${COLS} FROM users WHERE username = $1`, [username]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await getPool().query(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export function toPublic(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
