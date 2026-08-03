// Secure, at-rest storage for the JWT + cached user profile.
// expo-secure-store backs onto Keychain (iOS) / EncryptedSharedPreferences (Android) —
// never plain text, per the subject's security requirement.
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/auth';

const TOKEN_KEY = 'swifty_protein_token';
const USER_KEY = 'swifty_protein_user';

export async function saveSession(token: string, user: User): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

// A keystore read can throw, not just return null — a corrupted Keychain entry, a
// device where SecureStore is unavailable, or the web target the README mentions.
// "No session" is the safe answer to every one of those: it shows the Login view,
// which is what the subject wants anyway.
export async function loadSession(): Promise<{ token: string; user: User } | null> {
  try {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!token || !userJson) return null;
    return { token, user: JSON.parse(userJson) as User };
  } catch {
    return null;
  }
}

// Best-effort: the caller drops the session from memory regardless, so a failed
// delete must not leave the user stuck on a screen they asked to leave.
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // ignore
  }
}
