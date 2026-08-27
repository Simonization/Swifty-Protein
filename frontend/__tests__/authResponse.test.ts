// Pure-logic test against a mocked global fetch — no live network.
// General instructions require validating all data received from the network;
// this covers the shape check register()/login() apply on top of apiRequest's
// envelope validation (status, JSON parseability).
import { register, login } from '../src/api/auth';
import { ApiError } from '../src/api/client';

describe('auth response validation', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockJson = (body: unknown, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    }) as unknown as typeof fetch;
  };

  it('accepts a well-formed response', async () => {
    mockJson({ token: 't', user: { id: '1', username: 'ada', createdAt: '2026-01-01T00:00:00.000Z' } });
    await expect(login('ada', 'password123')).resolves.toMatchObject({ token: 't' });
  });

  it('rejects a 200 response missing the token', async () => {
    mockJson({ user: { id: '1', username: 'ada', createdAt: '2026-01-01T00:00:00.000Z' } });
    await expect(login('ada', 'password123')).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a 200 response with a malformed user object', async () => {
    mockJson({ token: 't', user: { id: 1, username: 'ada' } }); // id is a number, createdAt missing
    await expect(register('ada', 'password123')).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a 200 response that is not an object at all', async () => {
    mockJson('ok');
    await expect(login('ada', 'password123')).rejects.toBeInstanceOf(ApiError);
  });
});
