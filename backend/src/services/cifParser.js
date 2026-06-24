// CIF (Chemical Component Dictionary) parser for RCSB ligand files.
//
// Extracts what the 3D viewer needs from files.rcsb.org/ligands/download/<ID>.cif:
//   _chem_comp_atom  -> atoms (element, name, ideal coordinates)
//   _chem_comp_bond  -> bonds (atom pair + order)
//   _chem_comp.name / .formula -> metadata
//
// Pragmatic parser for the CCD subset we need, not a full mmCIF implementation.

// Split a CIF line into tokens, respecting '...' and "..." quoting.
function tokenize(line) {
  const tokens = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

// Parse the document into single-value items and loop tables.
function parseDocument(text) {
  const lines = text.split(/\r?\n/);
  const singles = {};
  const loops = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '' || line.startsWith('#') || line.startsWith('data_')) {
      i++;
      continue;
    }

    if (line === 'loop_') {
      i++;
      const headers = [];
      while (i < lines.length && lines[i].trim().startsWith('_')) {
        headers.push(lines[i].trim());
        i++;
      }
      const rows = [];
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
        singles[key] = toks.slice(1).join(' ');
        i++;
      } else if (i + 1 < lines.length && lines[i + 1].trim().startsWith(';')) {
        // multi-line text block ( ; ... ; )
        i += 1;
        const buf = [lines[i].trim().slice(1)];
        i++;
        while (i < lines.length && lines[i].trim() !== ';') {
          buf.push(lines[i]);
          i++;
        }
        i++; // skip the closing ';'
        singles[key] = buf.join('\n').trim();
      } else if (i + 1 < lines.length) {
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

const colIndex = (loop, suffix) => loop.headers.findIndex((h) => h.endsWith('.' + suffix));
const findLoop = (loops, prefix) => loops.find((l) => l.headers.some((h) => h.startsWith(prefix)));

// "CL" -> "Cl", "o" -> "O"
function normalizeElement(sym) {
  if (!sym) return 'X';
  return sym[0].toUpperCase() + sym.slice(1).toLowerCase();
}

const ORDER = { SING: 1, SINGLE: 1, DOUB: 2, DOUBLE: 2, TRIP: 3, TRIPLE: 3, AROM: 1, AROMATIC: 1 };
const isMissing = (v) => v === undefined || v === '?' || v === '.';

// Parse a ligand CIF into the Ligand shape from API.md.
// `fallbackId` is used when the file omits _chem_comp.id (e.g. test fixtures).
export function parseLigandCif(text, fallbackId) {
  const { singles, loops } = parseDocument(text);

  const atomLoop = findLoop(loops, '_chem_comp_atom.');
  const bondLoop = findLoop(loops, '_chem_comp_bond.');

  const atoms = [];
  const idByName = new Map();

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
      const num = (idx) => (isMissing(row[idx]) ? 0 : Number(row[idx]));
      atoms.push({ id: serial, element: normalizeElement(row[elemI]), name, x: num(xI), y: num(yI), z: num(zI) });
      idByName.set(name, serial);
      serial++;
    }
  }

  const bonds = [];
  if (bondLoop) {
    const a1I = colIndex(bondLoop, 'atom_id_1');
    const a2I = colIndex(bondLoop, 'atom_id_2');
    const ordI = colIndex(bondLoop, 'value_order');
    for (const row of bondLoop.rows) {
      const a = idByName.get(row[a1I]);
      const b = idByName.get(row[a2I]);
      if (!a || !b) continue; // skip bonds referencing unknown atoms
      bonds.push({ a, b, order: ORDER[(row[ordI] ?? '').toUpperCase()] ?? 1 });
    }
  }

  // Assemble in contract order: id, name?, formula?, atoms, bonds.
  const ligand = { id: (singles['_chem_comp.id'] ?? fallbackId ?? '').toUpperCase() };
  if (singles['_chem_comp.name']) ligand.name = singles['_chem_comp.name'];
  if (singles['_chem_comp.formula']) ligand.formula = singles['_chem_comp.formula'];
  ligand.atoms = atoms;
  ligand.bonds = bonds;
  return ligand;
}
