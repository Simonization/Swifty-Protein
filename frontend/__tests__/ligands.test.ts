// Cache/network composition for loading a ligand (bonus VII.4).
// The cache and the network are both mocked, so this asserts the policy only.
import { readFileSync } from 'fs';
import { join } from 'path';

import { listCachedLigands, loadLigand } from '../src/data/ligands';
import { listCachedCodes, readCachedCif, writeCachedCif } from '../src/data/ligandCache';
import { fetchLigandCif, RcsbError } from '../src/lib/rcsb';

jest.mock('../src/data/ligandCache');
jest.mock('../src/lib/rcsb', () => ({
  ...jest.requireActual('../src/lib/rcsb'),
  fetchLigandCif: jest.fn(),
}));

const ATP = readFileSync(join(__dirname, 'fixtures', 'ATP.cif'), 'utf8');

const mockRead = readCachedCif as jest.MockedFunction<typeof readCachedCif>;
const mockWrite = writeCachedCif as jest.MockedFunction<typeof writeCachedCif>;
const mockList = listCachedCodes as jest.MockedFunction<typeof listCachedCodes>;
const mockFetch = fetchLigandCif as jest.MockedFunction<typeof fetchLigandCif>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadLigand', () => {
  it('serves a cached ligand without touching the network', async () => {
    mockRead.mockResolvedValue(ATP);

    const ligand = await loadLigand('atp');

    expect(ligand.atoms).toHaveLength(47);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches on a cache miss and caches the result', async () => {
    mockRead.mockResolvedValue(null);
    mockFetch.mockResolvedValue(ATP);

    const ligand = await loadLigand('ATP');

    expect(ligand.atoms).toHaveLength(47);
    expect(mockFetch).toHaveBeenCalledWith('ATP');
    expect(mockWrite).toHaveBeenCalledWith('ATP', ATP);
  });

  it('normalises the code before using it as a cache key', async () => {
    mockRead.mockResolvedValue(null);
    mockFetch.mockResolvedValue(ATP);

    await loadLigand('  atp  ');

    expect(mockRead).toHaveBeenCalledWith('ATP');
  });

  it('refetches when the cached entry is corrupt, rather than bricking the ligand', async () => {
    mockRead.mockResolvedValue('truncated garbage, no atoms here');
    mockFetch.mockResolvedValue(ATP);

    const ligand = await loadLigand('ATP');

    expect(ligand.atoms).toHaveLength(47);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith('ATP', ATP);
  });

  it('surfaces a parse error when the fetched file has no atoms, and caches nothing', async () => {
    mockRead.mockResolvedValue(null);
    mockFetch.mockResolvedValue('not a cif at all');

    await expect(loadLigand('ATP')).rejects.toThrow(RcsbError);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('propagates the offline error when nothing is cached', async () => {
    mockRead.mockResolvedValue(null);
    mockFetch.mockRejectedValue(new RcsbError('offline'));

    await expect(loadLigand('ATP')).rejects.toMatchObject({ kind: 'offline' });
  });
});

describe('listCachedLigands', () => {
  it('describes a cached ligand from the file already on disk, with no network', async () => {
    mockList.mockReturnValue(['ATP']);
    mockRead.mockResolvedValue(ATP);

    const cached = await listCachedLigands();

    expect(cached.get('ATP')).toEqual({
      id: 'ATP',
      name: "ADENOSINE-5'-TRIPHOSPHATE",
      formula: 'C10 H16 N5 O13 P3',
      atomCount: 47,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('omits a truncated entry rather than listing a ligand with no atoms', async () => {
    mockList.mockReturnValue(['ATP', 'BAD']);
    mockRead.mockImplementation(async (code) => (code === 'ATP' ? ATP : 'truncated, no atoms'));

    const cached = await listCachedLigands();

    expect([...cached.keys()]).toEqual(['ATP']);
  });

  it('is empty when nothing has been opened yet', async () => {
    mockList.mockReturnValue([]);

    expect((await listCachedLigands()).size).toBe(0);
  });
});
