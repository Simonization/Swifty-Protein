// Loading a ligand for the viewer: cache, network, parse — composed.
//
// This is the app layer that ../lib/rcsb.ts and ../lib/cif.ts are deliberately
// kept free of, so those two stay plain TypeScript that a test can run.
import { parseLigandCif } from '../lib/cif';
import { fetchLigandCif, normalizeLigandCode, RcsbError } from '../lib/rcsb';
import { readCachedCif, writeCachedCif } from './ligandCache';
import type { Ligand } from '../types';

// Cache-first (bonus VII.4): CCD entries are immutable reference data, so a hit
// means no network at all — instant re-open, and it works in airplane mode.
export async function loadLigand(id: string): Promise<Ligand> {
  const code = normalizeLigandCode(id);

  const cached = await readCachedCif(code);
  if (cached) {
    const ligand = parseLigandCif(cached, code);
    // A truncated entry (killed mid-write) must not brick this ligand forever:
    // fall through to the network and overwrite it.
    if (ligand.atoms.length > 0) return ligand;
  }

  const cif = await fetchLigandCif(code);
  const ligand = parseLigandCif(cif, code);
  if (ligand.atoms.length === 0) throw new RcsbError('parse');

  writeCachedCif(code, cif);
  return ligand;
}
