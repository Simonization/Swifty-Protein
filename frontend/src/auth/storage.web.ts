// Session storage for the browser preview.
//
// `expo-secure-store` is native-only: on web every call throws. saveSession was
// the one function in storage.ts without a try/catch, so registering in the
// browser created the account on the server, threw while persisting the token,
// and reported "Something went wrong" — after which the same username came back
// as already taken. The account had been created every time.
//
// The session is deliberately kept in memory only here, not in localStorage: the
// subject's requirement is a JWT at rest in the Keychain/Keystore, and putting
// one in a browser store to make a preview feel more complete would be a weaker
// claim wearing the same words. Web is for looking at the theme and the layout;
// reloading the tab signs you out, which is correct rather than unfortunate.
import type { User } from '../api/auth';

export async function saveSession(_token: string, _user: User): Promise<void> {
  // No-op: the caller holds the session in React state for this tab's lifetime.
}

export async function loadSession(): Promise<{ token: string; user: User } | null> {
  return null;
}

export async function clearSession(): Promise<void> {
  // Nothing was persisted, so there is nothing to remove.
}
