// Password hashing with Argon2id (modern best practice, per the project's
// crypto learning goal). The hash string embeds its own salt + parameters.
import argon2 from 'argon2';

export function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}
