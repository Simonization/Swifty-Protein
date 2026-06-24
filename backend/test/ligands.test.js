import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getLigand, listLigands } from '../src/services/ligands.js';

const here = dirname(fileURLToPath(import.meta.url));
const cif = readFileSync(join(here, 'fixtures', 'FOR.cif'), 'utf8');

const okResponse = { ok: true, status: 200, text: async () => cif };

test('listLigands filters case-insensitively by code', () => {
  assert.deepEqual(listLigands('a'), { ligands: [{ id: 'ATP' }, { id: 'NAD' }], count: 2 });
  assert.equal(listLigands('').count, 8);
});

test('getLigand fetches, parses, and caches (one fetch for repeat calls)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return okResponse;
  };
  const a = await getLigand('FOR', { fetchImpl });
  assert.equal(a.atoms.length, 4);
  const b = await getLigand('FOR', { fetchImpl }); // served from cache
  assert.equal(calls, 1);
  assert.equal(b, a);
});

test('getLigand returns null on RCSB 404', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
  assert.equal(await getLigand('NOPE', { fetchImpl }), null);
});

test('getLigand maps a network failure to a 502 upstream error', async () => {
  const fetchImpl = async () => {
    throw new Error('boom');
  };
  await assert.rejects(getLigand('ERRA', { fetchImpl }), (e) => e.statusCode === 502 && e.code === 'upstream_error');
});

test('getLigand maps a timeout to a 504 upstream error', async () => {
  const fetchImpl = async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  };
  await assert.rejects(getLigand('ERRB', { fetchImpl }), (e) => e.statusCode === 504 && e.code === 'upstream_timeout');
});
