// Offline cache for ligand CIF files — bonus VII.4.
//
// Chemical Component Dictionary entries are stable reference data (CU has not
// changed since 1999), so a cached file is preferred over the network rather
// than merely used as a fallback: a ligand you have opened before opens
// instantly, and keeps opening with no connection at all.
//
// Every failure here is non-fatal by design. The worst case for a broken cache
// is an ordinary fetch, so callers never have to handle a cache error.
import { Directory, File, Paths } from 'expo-file-system';

const DIR_NAME = 'ligands';

// The code is interpolated into a filename, so accept only real CCD ids and
// never a path. Ids are alphanumeric and at most 5 characters.
const isSafeCode = (code: string): boolean => /^[A-Z0-9]{1,5}$/.test(code);

function cacheFile(code: string): File {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${code}.cif`);
}

export async function readCachedCif(code: string): Promise<string | null> {
  if (!isSafeCode(code)) return null;
  try {
    const file = cacheFile(code);
    return file.exists ? await file.text() : null;
  } catch {
    return null; // an unreadable entry is just a cache miss
  }
}

export function writeCachedCif(code: string, cif: string): void {
  if (!isSafeCode(code)) return;
  try {
    const file = cacheFile(code);
    if (!file.exists) file.create();
    file.write(cif);
  } catch {
    // Best-effort: a failed write only costs the next open a fetch.
  }
}
