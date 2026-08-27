import { apiRequest, ApiError } from './client';

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

// General instructions (protein.md) require validating all data received from
// the network. apiRequest already validates the HTTP envelope (status, JSON
// parseability); this validates the *shape* of a successful body, so a
// malformed 200 — a backend bug, a misconfigured proxy at the Settings ->
// Backend URL address — fails as a clear error here rather than reaching
// `user.username` as undefined three screens later.
function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== 'object') return false;
  const { token, user } = value as Record<string, unknown>;
  if (typeof token !== 'string' || token.length === 0) return false;
  if (!user || typeof user !== 'object') return false;
  const { id, username, createdAt } = user as Record<string, unknown>;
  return typeof id === 'string' && typeof username === 'string' && typeof createdAt === 'string';
}

async function requestAuth(path: string, body: unknown): Promise<AuthResponse> {
  const json = await apiRequest<unknown>(path, { method: 'POST', body });
  if (!isAuthResponse(json)) {
    throw new ApiError('internal_error', 'The server returned an unexpected response. Please try again.');
  }
  return json;
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return requestAuth('/api/v1/auth/register', { username, password });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return requestAuth('/api/v1/auth/login', { username, password });
}
