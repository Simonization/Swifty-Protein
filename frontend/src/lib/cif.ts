// CIF (Chemical Component Dictionary) parser for RCSB ligand files.
//
// Extracts what the 3D viewer needs from files.rcsb.org/ligands/view/<ID>.cif:
//   _chem_comp_atom  -> atoms (element, name, ideal coordinates)
//   _chem_comp_bond  -> bonds (atom pair + order + aromatic flag)
//   _chem_comp.name / .formula -> metadata
//
// Pragmatic parser for the CCD subset we need, not a full mmCIF implementation.
// Ported from the original Node backend module (verified against live RCSB data,
// e.g. ATP -> 47 atoms / 49 bonds); the only behavioural addition is aromatic-bond
// capture for the bonus interactions.
import type { Atom, Bond, Ligand } from '../types';

interface Loop {
  headers: string[];
  rows: string[][];
}

// Split a CIF line into tokens, respecting '...' and "..." quoting.
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

// Parse the document into single-value items and loop tables.
function parseDocument(text: string): { singles: Record<string, string>; loops: Loop[] } {
  const lines = text.split(/\r?\n/);
  const singles: Record<string, string> = {};
  const loops: Loop[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '' || line.startsWith('#') || line.startsWith('data_')) {
      i++;
      continue;
    }

    if (line === 'loop_') {
      i++;
      const headers: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('_')) {
        headers.push(lines[i].trim());
        i++;
      }
      const rows: string[][] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l === '' || l.startsWith('#') || l === 'loop_' || l.startsWith('_') || l.startsWith('data_')) break;
        rows.push(tokenize(l));
        i++;
      }
      loops.push({ headers, rows });
      continue;
    }

    if (line.startsWith('_')) {
      const toks = tokenize(line);
      const key = toks[0];
      if (toks.length > 1) {
        // value on the same line: _chem_comp.name "FORMALDEHYDE"
        singles[key] = toks.slice(1).join(' ');
        i++;
      } else if (i + 1 < lines.length) {
        // value on the following line
        singles[key] = tokenize(lines[i + 1].trim()).join(' ');
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    i++;
  }

  return { singles, loops };
}

const colIndex = (loop: Loop, suffix: string): number =>
  loop.headers.findIndex((h) => h.endsWith('.' + suffix));
const findLoop = (loops: Loop[], prefix: string): Loop | undefined =>
  loops.find((l) => l.headers.some((h) => h.startsWith(prefix)));

// "CL" -> "Cl", "o" -> "O"
function normalizeElement(sym: string | undefined): string {
  if (!sym) return 'X';
  return sym[0].toUpperCase() + sym.slice(1).toLowerCase();
}

const ORDER: Record<string, 1 | 2 | 3> = {
  SING: 1, SINGLE: 1, DOUB: 2, DOUBLE: 2, TRIP: 3, TRIPLE: 3, AROM: 1, AROMATIC: 1,
};
const AROMATIC_ORDER = new Set(['AROM', 'AROMATIC']);
const isMissing = (v: string | undefined): boolean => v === undefined || v === '?' || v === '.';

// Parse a ligand CIF into the Ligand shape.
// `fallbackId` is used when the file omits _chem_comp.id (e.g. test fixtures).
export function parseLigandCif(text: string, fallbackId?: string): Ligand {
  const { singles, loops } = parseDocument(text);

  const atomLoop = findLoop(loops, '_chem_comp_atom.');
  const bondLoop = findLoop(loops, '_chem_comp_bond.');

  const atoms: Atom[] = [];
  const idByName = new Map<string, number>();

  if (atomLoop) {
    const nameI = colIndex(atomLoop, 'atom_id');
    const elemI = colIndex(atomLoop, 'type_symbol');
    // Prefer the idealised coordinates; fall back to model coordinates.
    let xI = colIndex(atomLoop, 'pdbx_model_Cartn_x_ideal');
    let yI = colIndex(atomLoop, 'pdbx_model_Cartn_y_ideal');
    let zI = colIndex(atomLoop, 'pdbx_model_Cartn_z_ideal');
    if (xI === -1) {
      xI = colIndex(atomLoop, 'model_Cartn_x');
      yI = colIndex(atomLoop, 'model_Cartn_y');
      zI = colIndex(atomLoop, 'model_Cartn_z');
    }

    let serial = 1;
    for (const row of atomLoop.rows) {
      const name = row[nameI];
      if (name === undefined) continue;
      const num = (idx: number): number => (isMissing(row[idx]) ? 0 : Number(row[idx]));
      atoms.push({ id: serial, element: normalizeElement(row[elemI]), name, x: num(xI), y: num(yI), z: num(zI) });
      idByName.set(name, serial);
      serial++;
    }
  }

  const bonds: Bond[] = [];
  if (bondLoop) {
    const a1I = colIndex(bondLoop, 'atom_id_1');
    const a2I = colIndex(bondLoop, 'atom_id_2');
    const ordI = colIndex(bondLoop, 'value_order');
    const aromI = colIndex(bondLoop, 'pdbx_aromatic_flag');
    for (const row of bondLoop.rows) {
      const a = idByName.get(row[a1I]);
      const b = idByName.get(row[a2I]);
      if (!a || !b) continue; // skip bonds referencing unknown atoms
      const orderToken = (row[ordI] ?? '').toUpperCase();
      const aromatic = AROMATIC_ORDER.has(orderToken) || (aromI !== -1 && row[aromI] === 'Y');
      const bond: Bond = { a, b, order: ORDER[orderToken] ?? 1 };
      if (aromatic) bond.aromatic = true;
      bonds.push(bond);
    }
  }

  // Assemble in contract order: id, name?, formula?, atoms, bonds.
  const ligand: Ligand = { id: (singles['_chem_comp.id'] ?? fallbackId ?? '').toUpperCase(), atoms: [], bonds: [] };
  if (singles['_chem_comp.name']) ligand.name = singles['_chem_comp.name'];
  if (singles['_chem_comp.formula']) ligand.formula = singles['_chem_comp.formula'];
  ligand.atoms = atoms;
  ligand.bonds = bonds;
  return ligand;
}
