// User store: Postgres when DATABASE_URL is set (Docker / prod), in-memory
// otherwise (local dev + tests). Both share one async interface, so callers
// don't care which is active.
import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { getPool } from '../db/pool.js';

// Strip the password hash before sending a user over the wire.
export function toPublic(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// --- in-memory (no DATABASE_URL) ---
const usersByName = new Map(); // username -> { id, username, passwordHash, createdAt }
const memory = {
  async init() {},
  async createUser({ username, passwordHash }) {
    const user = { id: randomUUID(), username, passwordHash, createdAt: new Date().toISOString() };
    usersByName.set(username, user);
    return user;
  },
  async findByUsername(username) {
    return usersByName.get(username) ?? null;
  },
  async findById(id) {
    for (const user of usersByName.values()) if (user.id === id) return user;
    return null;
  },
};

// --- Postgres ---
const COLS = 'id, username, password_hash AS "passwordHash", created_at AS "createdAt"';
const postgres = {
  async init() {
    // One idempotent table — run on boot. The id is generated in the app, so
    // this has no dependency on a specific Postgres version / pgcrypto.
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  },
  async createUser({ username, passwordHash }) {
    const { rows } = await getPool().query(
      `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING ${COLS}`,
      [randomUUID(), username, passwordHash],
    );
    return rows[0];
  },
  async findByUsername(username) {
    const { rows } = await getPool().query(`SELECT ${COLS} FROM users WHERE username = $1`, [username]);
    return rows[0] ?? null;
  },
  async findById(id) {
    const { rows } = await getPool().query(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },
};

const impl = config.databaseUrl ? postgres : memory;

export const init = () => impl.init();
export const createUser = (user) => impl.createUser(user);
export const findByUsername = (username) => impl.findByUsername(username);
export const findById = (id) => impl.findById(id);
