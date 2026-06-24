// Shared molecular data model for the Swifty-Proteins app.
// These are the shapes the 3D viewer consumes; produced by the CIF parser.

export interface Atom {
  id: number; // 1-based serial — bonds reference this
  element: string; // canonical symbol: "C", "O", "Cl", ...
  name: string; // atom label from the source file (e.g. "C1", "PG")
  x: number; // Ångström
  y: number;
  z: number;
}

export interface Bond {
  a: number; // atom id
  b: number; // atom id
  order: 1 | 2 | 3; // single / double / triple
  aromatic?: boolean; // true for aromatic bonds (order falls back to 1)
}

export interface Ligand {
  id: string;
  name?: string;
  formula?: string;
  atoms: Atom[];
  bonds: Bond[];
}

export interface LigandSummary {
  id: string;
  name?: string;
}

export interface Element {
  symbol: string;
  name: string;
  number: number; // atomic number
  cpkHex: string; // CPK/Jmol color, no leading '#'
  radius: number; // van der Waals radius (Å) — for sphere scaling
}
