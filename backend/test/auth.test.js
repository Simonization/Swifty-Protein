import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

// One app instance for the file; the in-memory user store is shared, so tests
// use distinct usernames (except the duplicate-registration test on purpose).
let app;
before(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});
after(async () => {
  await app.close();
});

const register = (username, password) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username, password } });

test('GET /health', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });
});

test('register returns a token and a public user (no password hash)', async () => {
  const res = await register('alice', 'supersecret');
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.ok(body.token, 'expected a token');
  assert.equal(body.user.username, 'alice');
  assert.equal(body.user.passwordHash, undefined);
});

test('duplicate registration -> 409 username_taken', async () => {
  await register('bob', 'supersecret');
  const res = await register('bob', 'supersecret');
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error.code, 'username_taken');
});

test('login succeeds with correct credentials, 401 otherwise', async () => {
  await register('carol', 'supersecret');
  const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'carol', password: 'supersecret' } });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().token);

  const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'carol', password: 'wrongpass1' } });
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.json().error.code, 'invalid_credentials');
});

test('GET /me requires a valid token', async () => {
  const token = (await register('dave', 'supersecret')).json().token;

  const noAuth = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
  assert.equal(noAuth.statusCode, 401);
  assert.equal(noAuth.json().error.code, 'unauthorized');

  const withAuth = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${token}` } });
  assert.equal(withAuth.statusCode, 200);
  assert.equal(withAuth.json().user.username, 'dave');
});

test('validation: short password -> 400 validation_error', async () => {
  const res = await register('eve', 'short');
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, 'validation_error');
});

test('retired ligand/element routes return 404', async () => {
  const lig = await app.inject({ method: 'GET', url: '/api/v1/ligands' });
  assert.equal(lig.statusCode, 404);
  const el = await app.inject({ method: 'GET', url: '/api/v1/elements/O' });
  assert.equal(el.statusCode, 404);
});
