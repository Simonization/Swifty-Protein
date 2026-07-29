import { apiRequest } from './client';

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: { username, password },
  });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}
