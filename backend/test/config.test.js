import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// config.js throws at module-load time, so the guard can only be observed by
// loading it fresh in its own process -- importing it once in this file's
// process (as app.test.js already does, indirectly) would only ever exercise
// whichever env this test runner happens to start with.
const configUrl = pathToFileURL(fileURLToPath(new URL('../src/config.js', import.meta.url))).href;

function loadConfigWith(env) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import(${JSON.stringify(configUrl)}).then(() => process.exit(0), () => process.exit(1));`],
    { env: { ...process.env, ...env }, encoding: 'utf8' }
  );
}

test('refuses to boot in production with no JWT_SECRET set', () => {
  const result = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: undefined });
  assert.equal(result.status, 1, 'expected config.js to throw and exit non-zero');
});

test('boots in production once a real JWT_SECRET is set', () => {
  const result = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: 'a-real-secret' });
  assert.equal(result.status, 0);
});

test('boots outside production even with no JWT_SECRET (falls back to the dev secret)', () => {
  const result = loadConfigWith({ NODE_ENV: undefined, JWT_SECRET: undefined });
  assert.equal(result.status, 0);
});
