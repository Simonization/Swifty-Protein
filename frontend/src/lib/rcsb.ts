// Fetch a ligand's CIF text from RCSB.
//
// Subject-mandated source + URL (protein.md:135, 218):
//   https://files.rcsb.org/ligands/view/{ligand}.cif
//
// Errors are mapped to typed kinds so the UI can show the differentiated,
// user-friendly messages the subject requires (protein.md:221-225).
//
// Network and error mapping only: no React Native dependencies, so this stays
// testable as plain TypeScript. Caching (bonus VII.4) and parsing are composed
// on top in ../data/ligands.ts, which is the app layer this file always
// expected to be wrapped by.

export type RcsbErrorKind = 'not_found' | 'offline' | 'server' | 'timeout' | 'parse' | 'too_large';

const MESSAGES: Record<RcsbErrorKind, string> = {
  not_found: 'Ligand not found (404). This ligand may not exist in the database.',
  offline: 'No internet connection. Please check your network.',
  // Reached us, but failed at their end — a different fix for the user than
  // "check your network", so a different kind.
  server: 'RCSB could not serve this ligand right now. Please try again shortly.',
  timeout: 'Request timeout. Please try again.',
  parse: 'Failed to parse ligand data. The file may be corrupted.',
  too_large: 'This ligand file is too large to load. Please try a different ligand.',
};

// The largest real CCD entries are a few hundred KB of text; 5 MB is a
// pragmatic ceiling that rejects a malformed or hostile response before it
// reaches the parser, without needing a streaming read.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class RcsbError extends Error {
  kind: RcsbErrorKind;
  constructor(kind: RcsbErrorKind, message?: string) {
    super(message ?? MESSAGES[kind]);
    this.name = 'RcsbError';
    this.kind = kind;
  }
}

const ligandUrl = (code: string): string => `https://files.rcsb.org/ligands/view/${code}.cif`;

// "atp" -> "ATP". The canonical form used for the URL and as the cache key.
export const normalizeLigandCode = (id: string): string => id.trim().toUpperCase();

export async function fetchLigandCif(code: string, timeoutMs = 8000): Promise<string> {
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
  if (!res.ok) throw new RcsbError('server', `RCSB returned ${res.status}. Please try again shortly.`);

  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new RcsbError('too_large');
  return text;
}
