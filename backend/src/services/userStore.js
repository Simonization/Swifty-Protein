// In-memory user store — lets the API run with ZERO external dependencies so
// Rodolfo can integrate auth on day 1.
//
// TODO (Week 2): swap these functions for Postgres-backed queries. Keep the
// same signatures and the routes won't change. Data is lost on restart for now.
import { randomUUID } from 'node:crypto';

const usersByName = new Map(); // username -> { id, username, passwordHash, createdAt }

export function createUser({ username, passwordHash }) {
  const user = {
    id: randomUUID(),
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  usersByName.set(username, user);
  return user;
}

export function findByUsername(username) {
  return usersByName.get(username) ?? null;
}

export function findById(id) {
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
