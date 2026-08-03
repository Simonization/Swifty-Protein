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
  // Returns null when the username is taken, mirroring the Postgres path.
  // A plain `.set()` here silently *overwrote* the first account's id and hash,
  // which is the same uniqueness bug the UNIQUE constraint catches on the other
  // path — except nothing catches it, and this is the store `npm run dev` and
  // every test use.
  async createUser({ username, passwordHash }) {
    if (usersByName.has(username)) return null;
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
  // ON CONFLICT DO NOTHING makes the uniqueness check and the insert one
  // atomic step. Checking first and inserting second leaves a window in which
  // two concurrent registrations both pass the check; the loser then hit the
  // UNIQUE constraint, the driver threw, and the error handler turned that into
  // a 500 rather than the 409 the API documents. Returns null when taken.
  async createUser({ username, passwordHash }) {
    const { rows } = await getPool().query(
      `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING RETURNING ${COLS}`,
      [randomUUID(), username, passwordHash],
    );
    return rows[0] ?? null;
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
