// Runs under the app's Jest runner (jest-expo) once the Expo app is scaffolded.
// Pure-logic test — no React Native imports — so it is fast and deterministic.
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseLigandCif } from '../src/lib/cif';

const load = (id: string): string => readFileSync(join(__dirname, 'fixtures', `${id}.cif`), 'utf8');
const cif = load('FOR');

describe('parseLigandCif', () => {
  it('parses metadata (id, name, formula)', async () => {
    const lig = await parseLigandCif(cif, 'FOR');
    expect(lig.id).toBe('FOR');
    expect(lig.name).toBe('FORMALDEHYDE');
    expect(lig.formula).toBe('C H2 O');
  });

  it('parses atoms with ideal coordinates', async () => {
    const lig = await parseLigandCif(cif, 'FOR');
    expect(lig.atoms).toHaveLength(4);
    expect(lig.atoms[0]).toEqual({ id: 1, element: 'C', name: 'C', x: 0, y: 0, z: 0 });
    expect(lig.atoms[1]).toEqual({ id: 2, element: 'O', name: 'O', x: 1.2, y: 0, z: 0 });
  });

  it('parses bonds, resolving quoted atom names to ids and mapping order', async () => {
    const lig = await parseLigandCif(cif, 'FOR');
    expect(lig.bonds).toHaveLength(3);
    expect(lig.bonds[0]).toEqual({ a: 1, b: 2, order: 2 }); // C=O double
    expect(lig.bonds[1]).toEqual({ a: 1, b: 3, order: 1 }); // C-H1 single
  });

  it('returns empty atoms (not a throw) for unparseable input', async () => {
    const lig = await parseLigandCif('this is not a cif file', 'XXX');
    expect(lig.atoms).toHaveLength(0);
    expect(lig.bonds).toHaveLength(0);
    expect(lig.id).toBe('XXX');
  });

  it('does not crash on a loop_ truncated before any rows (EOF mid-file)', async () => {
    const truncated = [
      'data_BAD',
      '_chem_comp.id BAD',
      'loop_',
      '_chem_comp_atom.comp_id',
      '_chem_comp_atom.atom_id',
      '_chem_comp_atom.type_symbol',
    ].join('\n');
    const lig = await parseLigandCif(truncated, 'BAD');
    expect(lig.atoms).toHaveLength(0);
    expect(lig.bonds).toHaveLength(0);
  });

  it('does not crash when a bond row is shorter than its header list', async () => {
    const shortRow = [
      'data_BAD',
      '_chem_comp.id BAD',
      'loop_',
      '_chem_comp_atom.comp_id',
      '_chem_comp_atom.atom_id',
      '_chem_comp_atom.type_symbol',
      'BAD C1 C',
      'loop_',
      '_chem_comp_bond.comp_id',
      '_chem_comp_bond.atom_id_1',
      '_chem_comp_bond.atom_id_2',
      '_chem_comp_bond.value_order',
      'BAD "C1"', // missing atom_id_2 / value_order entirely
    ].join('\n');
    const lig = await parseLigandCif(shortRow, 'BAD');
    expect(lig.bonds).toHaveLength(0);
  });
});

// mmCIF drops `loop_` for single-row categories. The fixtures below are unmodified
// live RCSB files covering both shapes of that: un-looped atoms, and un-looped bonds.
describe('parseLigandCif — single-row categories', () => {
  it('reads the un-looped atom category of a 1-atom ligand (CU)', async () => {
    const lig = await parseLigandCif(load('CU'), 'CU');
    expect(lig.id).toBe('CU');
    expect(lig.atoms).toHaveLength(1);
    expect(lig.atoms[0]).toEqual({ id: 1, element: 'Cu', name: 'CU', x: 0, y: 0, z: 0 });
    expect(lig.bonds).toHaveLength(0);
  });

  it('reads the un-looped bond category of a 2-atom ligand (OXY)', async () => {
    const lig = await parseLigandCif(load('OXY'), 'OXY');
    expect(lig.atoms).toHaveLength(2);
    expect(lig.atoms.map((a) => a.element)).toEqual(['O', 'O']);
    // The bond is what makes this a stick rather than two loose spheres.
    expect(lig.bonds).toEqual([{ a: 1, b: 2, order: 2 }]);
  });
});

// A malformed coordinate token must not propagate NaN/Infinity into the
// renderer — it degrades to "atom at the ligand center" instead.
describe('parseLigandCif — non-finite coordinates', () => {
  const withRow = (x: string, y: string, z: string): string =>
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
      `BAD C1 C ${x} ${y} ${z}`,
    ].join('\n');

  it.each([
    ['non-numeric token', 'bogus'],
    ['overflows to +Infinity', '1e400'],
    ['overflows to -Infinity', '-1e400'],
    ['the literal token "Infinity"', 'Infinity'],
    ['the literal token "NaN"', 'NaN'],
  ])('falls back to 0 for %s, in every coordinate column', async (_label, token) => {
    expect((await parseLigandCif(withRow(token, '0.000', '0.000'), 'BAD')).atoms[0]).toEqual(
      expect.objectContaining({ x: 0 })
    );
    expect((await parseLigandCif(withRow('0.000', token, '0.000'), 'BAD')).atoms[0]).toEqual(
      expect.objectContaining({ y: 0 })
    );
    expect((await parseLigandCif(withRow('0.000', '0.000', token), 'BAD')).atoms[0]).toEqual(
      expect.objectContaining({ z: 0 })
    );
  });

  it('still resolves every atom and coordinate to a finite number', async () => {
    const lig = await parseLigandCif(withRow('1e400', '-1e400', 'bogus'), 'BAD');
    for (const atom of lig.atoms) {
      expect(Number.isFinite(atom.x)).toBe(true);
      expect(Number.isFinite(atom.y)).toBe(true);
      expect(Number.isFinite(atom.z)).toBe(true);
    }
  });

  // Regression guard: the finite-check must not disturb the pre-existing
  // "missing value" sentinels CIF uses (`?` = unknown, `.` = inapplicable).
  it('still maps the CIF missing-value sentinels to 0, unchanged', async () => {
    expect((await parseLigandCif(withRow('?', '.', '0.000'), 'BAD')).atoms[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });
});

describe('parseLigandCif — real-world ligand', () => {
  it('parses ATP to 47 atoms / 49 bonds', async () => {
    const lig = await parseLigandCif(load('ATP'), 'ATP');
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

// VII.4's "progress indication" for background parsing: the parser cannot move
// to a real OS thread here, but it must yield periodically and report where it
// is, so a large ligand's loading label can show real progress rather than an
// indefinite spinner.
describe('parseLigandCif — progress reporting', () => {
  it('reports completion (1) even for a tiny file with no intermediate ticks', async () => {
    const progress: number[] = [];
    await parseLigandCif(cif, 'FOR', (fraction) => progress.push(fraction));
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('reports increasing intermediate progress for a large ligand, ending at 1', async () => {
    const lines = ['data_BIG', '_chem_comp.id BIG', 'loop_', '_chem_comp_atom.comp_id', '_chem_comp_atom.atom_id', '_chem_comp_atom.type_symbol'];
    for (let i = 0; i < 3000; i++) lines.push(`BIG C${i} C`);
    const big = lines.join('\n');

    const progress: number[] = [];
    const lig = await parseLigandCif(big, 'BIG', (fraction) => progress.push(fraction));

    expect(lig.atoms).toHaveLength(3000);
    expect(progress.length).toBeGreaterThan(1); // at least one intermediate tick plus the final 1
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
    expect(progress[progress.length - 1]).toBe(1);
  });
});
