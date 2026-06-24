import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseLigandCif } from '../src/services/cifParser.js';

const here = dirname(fileURLToPath(import.meta.url));
const cif = readFileSync(join(here, 'fixtures', 'FOR.cif'), 'utf8');

test('parses metadata (id, name, formula)', () => {
  const lig = parseLigandCif(cif, 'FOR');
  assert.equal(lig.id, 'FOR');
  assert.equal(lig.name, 'FORMALDEHYDE');
  assert.equal(lig.formula, 'C H2 O');
});

test('parses atoms with ideal coordinates', () => {
  const lig = parseLigandCif(cif, 'FOR');
  assert.equal(lig.atoms.length, 4);
  assert.deepEqual(lig.atoms[0], { id: 1, element: 'C', name: 'C', x: 0, y: 0, z: 0 });
  assert.deepEqual(lig.atoms[1], { id: 2, element: 'O', name: 'O', x: 1.2, y: 0, z: 0 });
});

test('parses bonds, resolving quoted atom names to ids and mapping order', () => {
  const lig = parseLigandCif(cif, 'FOR');
  assert.equal(lig.bonds.length, 3);
  assert.deepEqual(lig.bonds[0], { a: 1, b: 2, order: 2 }); // C=O double
  assert.deepEqual(lig.bonds[1], { a: 1, b: 3, order: 1 }); // C-H1 single
});

test('returns empty atoms (not a throw) for unparseable input', () => {
  const lig = parseLigandCif('this is not a cif file', 'XXX');
  assert.equal(lig.atoms.length, 0);
  assert.equal(lig.bonds.length, 0);
  assert.equal(lig.id, 'XXX');
});
