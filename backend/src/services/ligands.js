// Ligand data source.
//
// For now: a static code list + one valid SAMPLE molecule returned for any id,
// so Rodolfo can build and test the 3D viewer before the real pipeline exists.
//
// TODO (Week 3): replace with the real pipeline —
//   1. Load the ligand code list from the provided `ligands.txt`.
//   2. getLigand(id): fetch the CIF from RCSB
//        https://files.rcsb.org/ligands/download/<ID>.cif
//      then parse atoms/bonds (see cifParser, to be written) and CACHE the result.
//   3. Map RCSB / network failures to 502 (upstream_error) / 504 (upstream_timeout).

const SAMPLE_CODES = ['ATP', 'HEM', 'GLC', 'NAD', 'CFF', 'BNZ', 'CO2', 'HOH'];

// A real, renderable little molecule (formaldehyde, CH2O): mixed elements +
// a double bond + single bonds — good for testing CPK colors and bond orders.
function sampleLigand(id) {
  return {
    id: id.toUpperCase(),
    name: 'Formaldehyde (SAMPLE — replace with real RCSB/CIF data)',
    formula: 'C H2 O',
    atoms: [
      { id: 1, element: 'C', name: 'C1', x: 0.0, y: 0.0, z: 0.0 },
      { id: 2, element: 'O', name: 'O1', x: 1.2, y: 0.0, z: 0.0 },
      { id: 3, element: 'H', name: 'H1', x: -0.5, y: 0.94, z: 0.0 },
      { id: 4, element: 'H', name: 'H2', x: -0.5, y: -0.94, z: 0.0 },
    ],
    bonds: [
      { a: 1, b: 2, order: 2 },
      { a: 1, b: 3, order: 1 },
      { a: 1, b: 4, order: 1 },
    ],
  };
}

export function listLigands(search = '') {
  const q = search.trim().toUpperCase();
  const ligands = SAMPLE_CODES.filter((code) => !q || code.includes(q)).map((id) => ({ id }));
  return { ligands, count: ligands.length };
}

export async function getLigand(id) {
  // Stub: always returns the sample. The real version will return null for
  // unknown codes so the route can answer 404.
  return sampleLigand(id);
}
