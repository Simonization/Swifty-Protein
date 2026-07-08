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

export async function loadSession(): Promise<{ token: string; user: User } | null> {
  const [token, userJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!token || !userJson) return null;
  try {
    return { token, user: JSON.parse(userJson) as User };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
