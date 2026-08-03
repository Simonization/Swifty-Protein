// Pure-logic test against a mocked global fetch — no live network.
import { fetchLigandCif } from '../src/lib/rcsb';

describe('fetchLigandCif — response size guard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockText = (text: string) => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => text,
    }) as unknown as typeof fetch;
  };

  it('rejects a response over the size ceiling as too_large', async () => {
    mockText('x'.repeat(5 * 1024 * 1024 + 1));
    await expect(fetchLigandCif('BIG')).rejects.toMatchObject({ kind: 'too_large' });
  });

  it('accepts a response under the ceiling', async () => {
    const body = 'data_OK\n';
    mockText(body);
    await expect(fetchLigandCif('OK')).resolves.toBe(body);
  });
});
