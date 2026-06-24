// Fetch a ligand's CIF directly from RCSB and parse it in-app.
//
// Subject-mandated source + URL (protein.md:135, 218):
//   https://files.rcsb.org/ligands/view/{ligand}.cif
//
// Errors are mapped to typed kinds so the UI can show the differentiated,
// user-friendly messages the subject requires (protein.md:221-225).
//
// Caching for offline access (protein.md:164, bonus VII.4) is a thin wrapper to
// be added in the app layer (e.g. expo-file-system / AsyncStorage around
// fetchLigand): on success, persist by code; on offline error, fall back to cache.
import { parseLigandCif } from './cif';
import type { Ligand } from '../types';

export type RcsbErrorKind = 'not_found' | 'offline' | 'timeout' | 'parse';

const MESSAGES: Record<RcsbErrorKind, string> = {
  not_found: 'Ligand not found (404). This ligand may not exist in the database.',
  offline: 'No internet connection. Please check your network.',
  timeout: 'Request timeout. Please try again.',
  parse: 'Failed to parse ligand data. The file may be corrupted.',
};

export class RcsbError extends Error {
  kind: RcsbErrorKind;
  constructor(kind: RcsbErrorKind, message?: string) {
    super(message ?? MESSAGES[kind]);
    this.name = 'RcsbError';
    this.kind = kind;
  }
}

const ligandUrl = (code: string): string => `https://files.rcsb.org/ligands/view/${code}.cif`;

export async function fetchLigand(id: string, timeoutMs = 8000): Promise<Ligand> {
  const code = id.trim().toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ligandUrl(code), { signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new RcsbError('timeout');
    throw new RcsbError('offline');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) throw new RcsbError('not_found');
  if (!res.ok) throw new RcsbError('offline', `RCSB returned ${res.status}. Please try again.`);

  const ligand = parseLigandCif(await res.text(), code);
  if (ligand.atoms.length === 0) throw new RcsbError('parse');
  return ligand;
}
