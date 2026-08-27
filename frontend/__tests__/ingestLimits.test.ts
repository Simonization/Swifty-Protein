// Integration check across the whole ingest path: a huge but well-formed CIF
// file parses correctly (parseLigandCif has no atom-count limit of its own —
// that's deliberate, see rcsb.ts/moleculeGeometry.ts), and the render-time cap
// downstream in moleculeGeometry.ts is what actually stops it, at the exact
// documented boundary. Two independent guards, tested together rather than
// only in isolation, so a change to either one's boundary shows up here too.
import { parseLigandCif } from '../src/lib/cif';
import { MAX_ATOMS, exceedsRenderLimits } from '../src/lib/moleculeGeometry';

// A single-row-per-atom, well-formed loop_ with `count` carbon atoms in a
// line, well under the 5MB network guard even at MAX_ATOMS+1 (~70KB).
function syntheticCif(atomCount: number): string {
  const lines = [
    'data_BIG',
    '_chem_comp.id BIG',
    'loop_',
    '_chem_comp_atom.comp_id',
    '_chem_comp_atom.atom_id',
    '_chem_comp_atom.type_symbol',
    '_chem_comp_atom.pdbx_model_Cartn_x_ideal',
    '_chem_comp_atom.pdbx_model_Cartn_y_ideal',
    '_chem_comp_atom.pdbx_model_Cartn_z_ideal',
  ];
  for (let i = 0; i < atomCount; i++) {
    lines.push(`BIG C${i} C ${i}.000 0.000 0.000`);
  }
  return lines.join('\n');
}

describe('ingest -> render-limit integration', () => {
  it('parses a ligand with exactly MAX_ATOMS atoms, and the render cap allows it', async () => {
    const lig = await parseLigandCif(syntheticCif(MAX_ATOMS), 'BIG');
    expect(lig.atoms).toHaveLength(MAX_ATOMS);
    expect(exceedsRenderLimits(lig.atoms.length, lig.bonds.length)).toBe(false);
  });

  it('parses a ligand one atom past MAX_ATOMS just fine -- parsing has no cap of its own', async () => {
    const lig = await parseLigandCif(syntheticCif(MAX_ATOMS + 1), 'BIG');
    expect(lig.atoms).toHaveLength(MAX_ATOMS + 1);
  });

  it('the render cap refuses that same ligand once parsed', async () => {
    const lig = await parseLigandCif(syntheticCif(MAX_ATOMS + 1), 'BIG');
    expect(exceedsRenderLimits(lig.atoms.length, lig.bonds.length)).toBe(true);
  });
});
