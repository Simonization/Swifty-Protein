import { listCachedCodes, readCachedCif, writeCachedCif } from '../src/data/ligandCache';

describe('ligandCache', () => {
  it('is empty before anything has been cached', () => {
    expect(listCachedCodes()).toEqual([]);
  });

  it('round-trips a cached CIF and lists it', async () => {
    writeCachedCif('ATP', 'data_ATP\n');
    expect(await readCachedCif('ATP')).toBe('data_ATP\n');
    expect(listCachedCodes()).toContain('ATP');
  });

  it('returns null for a well-formed code that was never cached', async () => {
    expect(await readCachedCif('ZZZZZ')).toBeNull();
  });

  // The code is interpolated into a filename, so this is a path-injection
  // guard, not just an input-shape check -- worth being explicit about.
  it('silently refuses a code shaped like a path rather than a CCD id', async () => {
    writeCachedCif('../evil', 'malicious content');
    expect(await readCachedCif('../evil')).toBeNull();
    expect(listCachedCodes()).not.toContain('../evil');
  });

  it('rejects lowercase and over-length codes the same way', async () => {
    expect(await readCachedCif('atp')).toBeNull(); // real codes are normalized upper before reaching here
    expect(await readCachedCif('TOOLONG')).toBeNull(); // CCD ids are at most 5 characters
  });
});
