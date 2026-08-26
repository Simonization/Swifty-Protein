// The web build of session storage.
//
// expo-secure-store is native-only and throws on every call there. saveSession
// in storage.ts was the one function without a try/catch, so registering in the
// browser created the account, threw while persisting, and reported "Something
// went wrong" -- and the retry answered "username already taken", because the
// account had been created the first time.
//
// These assert the two properties that keep that from coming back: nothing here
// throws, and nothing here claims to have a stored session.
import { clearSession, loadSession, saveSession } from '../src/auth/storage.web';
import type { User } from '../src/api/auth';

const user: User = { id: 'u1', username: 'tester', createdAt: '2026-08-25T00:00:00.000Z' };

describe('web session storage', () => {
  it('saving never throws, whatever it is handed', async () => {
    await expect(saveSession('a-token', user)).resolves.toBeUndefined();
  });

  it('reports no stored session rather than a stale one', async () => {
    await saveSession('a-token', user);
    await expect(loadSession()).resolves.toBeNull();
  });

  it('clearing never throws', async () => {
    await expect(clearSession()).resolves.toBeUndefined();
  });
});
