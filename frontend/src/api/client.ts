// Thin client for the auth-only backend (see ../../../API.md for the contract).
// Set EXPO_PUBLIC_API_URL to point at the backend, e.g. http://192.168.1.20:3000
// (a LAN IP, not "localhost", when testing on a physical device).
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export type ApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'not_found'
  | 'username_taken'
  | 'internal_error'
  | 'network_error'
  | 'timeout';

const FRIENDLY_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  network_error: 'No internet connection. Please check your network and try again.',
  timeout: 'Request timed out. Please try again.',
  internal_error: 'Something went wrong on our end. Please try again shortly.',
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 10000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('timeout', FRIENDLY_MESSAGES.timeout!);
    }
    throw new ApiError('network_error', FRIENDLY_MESSAGES.network_error!);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // A 502 page, a captive portal, or any proxy in front of the API answers
      // with HTML. Report that as an ApiError like every other failure here,
      // rather than throwing a raw SyntaxError past the model callers handle.
      throw new ApiError('internal_error', FRIENDLY_MESSAGES.internal_error!, res.status);
    }
  }

  if (!res.ok) {
    const code: ApiErrorCode = json?.error?.code ?? 'internal_error';
    const message = json?.error?.message ?? FRIENDLY_MESSAGES[code] ?? 'Something went wrong.';
    throw new ApiError(code, message, res.status);
  }

  return json as T;
}
