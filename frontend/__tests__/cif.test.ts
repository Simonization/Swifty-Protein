// Runs under the app's Jest runner (jest-expo) once the Expo app is scaffolded.
// Pure-logic test — no React Native imports — so it is fast and deterministic.
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseLigandCif } from '../src/lib/cif';

const cif = readFileSync(join(__dirname, 'fixtures', 'FOR.cif'), 'utf8');

describe('parseLigandCif', () => {
  it('parses metadata (id, name, formula)', () => {
    const lig = parseLigandCif(cif, 'FOR');
    expect(lig.id).toBe('FOR');
    expect(lig.name).toBe('FORMALDEHYDE');
    expect(lig.formula).toBe('C H2 O');
  });

  it('parses atoms with ideal coordinates', () => {
    const lig = parseLigandCif(cif, 'FOR');
    expect(lig.atoms).toHaveLength(4);
    expect(lig.atoms[0]).toEqual({ id: 1, element: 'C', name: 'C', x: 0, y: 0, z: 0 });
    expect(lig.atoms[1]).toEqual({ id: 2, element: 'O', name: 'O', x: 1.2, y: 0, z: 0 });
  });

  it('parses bonds, resolving quoted atom names to ids and mapping order', () => {
    const lig = parseLigandCif(cif, 'FOR');
    expect(lig.bonds).toHaveLength(3);
    expect(lig.bonds[0]).toEqual({ a: 1, b: 2, order: 2 }); // C=O double
    expect(lig.bonds[1]).toEqual({ a: 1, b: 3, order: 1 }); // C-H1 single
  });

  it('returns empty atoms (not a throw) for unparseable input', () => {
    const lig = parseLigandCif('this is not a cif file', 'XXX');
    expect(lig.atoms).toHaveLength(0);
    expect(lig.bonds).toHaveLength(0);
    expect(lig.id).toBe('XXX');
  });
});
