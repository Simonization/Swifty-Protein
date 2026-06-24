// User store facade: Postgres when DATABASE_URL is set (Docker / prod),
// in-memory otherwise (local dev + tests). Both implementations share the same
// async interface, so callers don't care which is active.
import { config } from '../config.js';
import * as memory from './userStore.memory.js';
import * as postgres from './userStore.pg.js';

const impl = config.databaseUrl ? postgres : memory;

export const init = () => impl.init();
export const createUser = (user) => impl.createUser(user);
export const findByUsername = (username) => impl.findByUsername(username);
export const findById = (id) => impl.findById(id);
export const toPublic = (user) => impl.toPublic(user);
