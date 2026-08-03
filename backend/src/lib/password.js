// Password hashing with Argon2id (modern best practice, per the project's
// crypto learning goal). The hash string embeds its own salt + parameters.
import argon2 from 'argon2';

// Pinned, not inherited. `argon2` picks its own defaults, and a caret-ranged
// minor bump can change them silently — so the cost of every hash in this
// database would depend on which day it was written. These are the OWASP
// Password Storage Cheat Sheet's Argon2id parameters: 19 MiB, 2 iterations,
// 1 degree of parallelism.
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB — 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}

// A real Argon2id hash of a value nothing can log in with, verified against
// when the username does not exist. Without it, login short-circuits: a missing
// user answers in about a millisecond while a real one costs a full verify, and
// that difference is an oracle for enumerating which accounts exist.
//
// Computed once, lazily, so start-up doesn't pay for it and every later probe
// costs the same as a real attempt.
let decoyHash = null;
export async function verifyPasswordAgainstDecoy(plain) {
  decoyHash ??= await argon2.hash(`decoy:${Math.random()}`, ARGON2_OPTIONS);
  try {
    return await argon2.verify(decoyHash, plain);
  } catch {
    return false;
  }
}
