// In-memory user store — used for local dev (no DATABASE_URL) and tests.
// Async to match the Postgres implementation. Data is lost on restart.
import { randomUUID } from 'node:crypto';

const usersByName = new Map(); // username -> { id, username, passwordHash, createdAt }

export async function init() {
  // nothing to set up
}

export async function createUser({ username, passwordHash }) {
  const user = {
    id: randomUUID(),
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  usersByName.set(username, user);
  return user;
}

export async function findByUsername(username) {
  return usersByName.get(username) ?? null;
}

export async function findById(id) {
  for (const user of usersByName.values()) {
    if (user.id === id) return user;
  }
  return null;
}

// Strip the password hash before sending a user over the wire.
export function toPublic(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
