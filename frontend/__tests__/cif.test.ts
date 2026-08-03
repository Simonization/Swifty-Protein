// Runs under the app's Jest runner (jest-expo) once the Expo app is scaffolded.
// Pure-logic test — no React Native imports — so it is fast and deterministic.
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseLigandCif } from '../src/lib/cif';

const load = (id: string): string => readFileSync(join(__dirname, 'fixtures', `${id}.cif`), 'utf8');
const cif = load('FOR');

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

// mmCIF drops `loop_` for single-row categories. The fixtures below are unmodified
// live RCSB files covering both shapes of that: un-looped atoms, and un-looped bonds.
describe('parseLigandCif — single-row categories', () => {
  it('reads the un-looped atom category of a 1-atom ligand (CU)', () => {
    const lig = parseLigandCif(load('CU'), 'CU');
    expect(lig.id).toBe('CU');
    expect(lig.atoms).toHaveLength(1);
    expect(lig.atoms[0]).toEqual({ id: 1, element: 'Cu', name: 'CU', x: 0, y: 0, z: 0 });
    expect(lig.bonds).toHaveLength(0);
  });

  it('reads the un-looped bond category of a 2-atom ligand (OXY)', () => {
    const lig = parseLigandCif(load('OXY'), 'OXY');
    expect(lig.atoms).toHaveLength(2);
    expect(lig.atoms.map((a) => a.element)).toEqual(['O', 'O']);
    // The bond is what makes this a stick rather than two loose spheres.
    expect(lig.bonds).toEqual([{ a: 1, b: 2, order: 2 }]);
  });
});

// A malformed coordinate token must not propagate NaN/Infinity into the
// renderer — it degrades to "atom at the ligand center" instead.
describe('parseLigandCif — non-finite coordinates', () => {
  const withXToken = (token: string): string =>
    [
      'data_BAD',
      '_chem_comp.id BAD',
      'loop_',
      '_chem_comp_atom.comp_id',
      '_chem_comp_atom.atom_id',
      '_chem_comp_atom.type_symbol',
      '_chem_comp_atom.pdbx_model_Cartn_x_ideal',
      '_chem_comp_atom.pdbx_model_Cartn_y_ideal',
      '_chem_comp_atom.pdbx_model_Cartn_z_ideal',
      `BAD C1 C ${token} 0.000 0.000`,
    ].join('\n');

  it('falls back to 0 for a non-numeric coordinate token', () => {
    const lig = parseLigandCif(withXToken('bogus'), 'BAD');
    expect(lig.atoms).toHaveLength(1);
    expect(lig.atoms[0].x).toBe(0);
  });

  it('falls back to 0 for a coordinate that parses to Infinity', () => {
    const lig = parseLigandCif(withXToken('1e400'), 'BAD');
    expect(lig.atoms[0].x).toBe(0);
  });
});

describe('parseLigandCif — real-world ligand', () => {
  it('parses ATP to 47 atoms / 49 bonds', () => {
    const lig = parseLigandCif(load('ATP'), 'ATP');
    expect(lig.atoms).toHaveLength(47);
    expect(lig.bonds).toHaveLength(49);
    // Every bond resolves to a real atom id (no silent drops from idByName misses).
    const ids = new Set(lig.atoms.map((a) => a.id));
    for (const b of lig.bonds) {
      expect(ids.has(b.a)).toBe(true);
      expect(ids.has(b.b)).toBe(true);
    }
  });
});
