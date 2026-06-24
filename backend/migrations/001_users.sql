-- Accounts for biometric/password login. Idempotent so init() can run it on
-- every boot. The id is generated in the app (randomUUID) and inserted, so this
-- has no dependency on a specific Postgres version / pgcrypto.
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
