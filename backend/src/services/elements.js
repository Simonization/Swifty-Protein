// Per-element reference data: CPK/Jmol colors + van der Waals radii (Å).
// Covers the elements common in ligands; extend as needed.
// Colors are the standard CPK/Jmol hex values (no leading '#').
const ELEMENTS = [
  { symbol: 'H', name: 'Hydrogen', number: 1, cpkHex: 'FFFFFF', radius: 1.2 },
  { symbol: 'C', name: 'Carbon', number: 6, cpkHex: '909090', radius: 1.7 },
  { symbol: 'N', name: 'Nitrogen', number: 7, cpkHex: '3050F8', radius: 1.55 },
  { symbol: 'O', name: 'Oxygen', number: 8, cpkHex: 'FF0D0D', radius: 1.52 },
  { symbol: 'F', name: 'Fluorine', number: 9, cpkHex: '90E050', radius: 1.47 },
  { symbol: 'NA', name: 'Sodium', number: 11, cpkHex: 'AB5CF2', radius: 2.27 },
  { symbol: 'MG', name: 'Magnesium', number: 12, cpkHex: '8AFF00', radius: 1.73 },
  { symbol: 'P', name: 'Phosphorus', number: 15, cpkHex: 'FF8000', radius: 1.8 },
  { symbol: 'S', name: 'Sulfur', number: 16, cpkHex: 'FFFF30', radius: 1.8 },
  { symbol: 'CL', name: 'Chlorine', number: 17, cpkHex: '1FF01F', radius: 1.75 },
  { symbol: 'K', name: 'Potassium', number: 19, cpkHex: '8F40D4', radius: 2.75 },
  { symbol: 'CA', name: 'Calcium', number: 20, cpkHex: '3DFF00', radius: 2.31 },
  { symbol: 'FE', name: 'Iron', number: 26, cpkHex: 'E06633', radius: 2.0 },
  { symbol: 'ZN', name: 'Zinc', number: 30, cpkHex: '7D80B0', radius: 2.0 },
  { symbol: 'BR', name: 'Bromine', number: 35, cpkHex: 'A62929', radius: 1.85 },
  { symbol: 'I', name: 'Iodine', number: 53, cpkHex: '940094', radius: 1.98 },
];

// Default for any element not in the table (CPK "unknown" pink).
const DEFAULT = { symbol: 'X', name: 'Unknown', number: 0, cpkHex: 'FF1493', radius: 1.6 };

const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function allElements() {
  return ELEMENTS;
}

export function getElement(symbol) {
  if (!symbol) return null;
  return bySymbol.get(symbol.toUpperCase()) ?? null;
}

// For internal use by the renderer-facing code: never returns null.
export function colorFor(symbol) {
  return bySymbol.get((symbol ?? '').toUpperCase()) ?? DEFAULT;
}
