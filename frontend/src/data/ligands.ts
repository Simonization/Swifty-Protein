// Loading a ligand for the viewer: cache, network, parse — composed.
//
// This is the app layer that ../lib/rcsb.ts and ../lib/cif.ts are deliberately
// kept free of, so those two stay plain TypeScript that a test can run.
import { parseLigandCif, type ParseProgress } from '../lib/cif';
import { fetchLigandCif, normalizeLigandCode, RcsbError } from '../lib/rcsb';
import { listCachedCodes, readCachedCif, writeCachedCif } from './ligandCache';
import type { Ligand } from '../types';

// Cache-first (bonus VII.4): CCD entries are immutable reference data, so a hit
// means no network at all — instant re-open, and it works in airplane mode.
// `onProgress` (0..1) lets the caller show parse progress for large ligands —
// see lib/cif.ts. It is only passed to the network-fetched parse below: a
// cache hit is a few KB read from disk, over before progress would mean
// anything, and reporting it there too would make the caller's progress
// state jump to 1 and then back down again if the cache turns out truncated.
export async function loadLigand(id: string, onProgress?: ParseProgress): Promise<Ligand> {
  const code = normalizeLigandCode(id);

  const cached = await readCachedCif(code);
  if (cached) {
    const ligand = await parseLigandCif(cached, code);
    // A truncated entry (killed mid-write) must not brick this ligand forever:
    // fall through to the network and overwrite it.
    if (ligand.atoms.length > 0) return ligand;
  }

  const cif = await fetchLigandCif(code);
  const ligand = await parseLigandCif(cif, code, onProgress);
  if (ligand.atoms.length === 0) throw new RcsbError('parse');

  writeCachedCif(code, cif);
  return ligand;
}

// What a cached ligand can tell the list screen about itself without a network
// round-trip: a name and a formula the list would otherwise never have.
export interface CachedLigand {
  id: string;
  name?: string;
  formula?: string;
  atomCount: number;
}

// Re-parsing the cached files is cheap (a few KB each, only for ligands the
// user has actually opened) and cannot fall out of sync the way a separate
// index of names written alongside them could.
export async function listCachedLigands(): Promise<Map<string, CachedLigand>> {
  const entries = await Promise.all(
    listCachedCodes().map(async (code): Promise<[string, CachedLigand] | null> => {
      const cif = await readCachedCif(code);
      if (!cif) return null;
      const ligand = await parseLigandCif(cif, code);
      if (ligand.atoms.length === 0) return null; // truncated entry: loadLigand will refetch it
      return [code, { id: code, name: ligand.name, formula: ligand.formula, atomCount: ligand.atoms.length }];
    })
  );
  return new Map(entries.filter((entry): entry is [string, CachedLigand] => entry !== null));
}
