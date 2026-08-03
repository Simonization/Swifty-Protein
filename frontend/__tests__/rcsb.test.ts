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

  it('accepts a response at exactly the ceiling (boundary, not off-by-one)', async () => {
    mockText('x'.repeat(5 * 1024 * 1024));
    await expect(fetchLigandCif('EXACT')).resolves.toHaveLength(5 * 1024 * 1024);
  });

  it('never buffers-then-checks for a non-2xx response, regardless of body size', async () => {
    // A malicious or broken proxy returning a huge error page must not even
    // reach res.text() -- 404 and other non-ok statuses are rejected before
    // the size guard runs at all, so this asserts .text() is never called.
    const text = jest.fn().mockResolvedValue('x'.repeat(10 * 1024 * 1024));
    global.fetch = jest.fn().mockResolvedValue({ status: 500, ok: false, text }) as unknown as typeof fetch;
    await expect(fetchLigandCif('BROKEN')).rejects.toMatchObject({ kind: 'server' });
    expect(text).not.toHaveBeenCalled();
  });

  it('distinguishes a reachable-but-failing RCSB from a dead network', async () => {
    // The user's fix differs: "try again shortly" vs "check your network".
    // Titling a 503 "No connection" over a body that names the status reads as
    // a bug to anyone testing error handling.
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 503, ok: false, text: jest.fn() }) as unknown as typeof fetch;
    await expect(fetchLigandCif('DOWN')).rejects.toMatchObject({ kind: 'server' });

    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(fetchLigandCif('NONET')).rejects.toMatchObject({ kind: 'offline' });
  });
});
