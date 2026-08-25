// Thin client for the auth-only backend (see ../../../README.md for the contract).
//
// EXPO_PUBLIC_API_URL is inlined at build time, and its default points at the
// device itself -- useless on a real phone, where the backend is on someone
// else's laptop. So it is only the default here: Settings can override it at
// runtime (bonus VII.2), which is what makes a built app usable on a device
// that was not the one that built it.
const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '');

export const DEFAULT_API_BASE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
);

let apiBaseUrl = DEFAULT_API_BASE_URL;

export const getApiBaseUrl = (): string => apiBaseUrl;

// Applied at startup from persisted settings, and on every save.
export function setApiBaseUrl(url: string): void {
  apiBaseUrl = stripTrailingSlash(url.trim()) || DEFAULT_API_BASE_URL;
}

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
  network_error: 'Could not reach the server. Check the address in Settings.',
  timeout: 'Request timed out. Please try again.',
  internal_error: 'Something went wrong on our end. Please try again shortly.',
};

// A failed fetch here is almost never "no internet" -- the backend is a laptop on
// the same LAN, and the address is a setting that starts out wrong on any device
// that did not build the app. Saying "check your network" sent people to their
// wi-fi settings; naming the address they are actually failing to reach sends
// them to the one control that fixes it.
export const describeNetworkFailure = (url: string): string =>
  `Could not reach the server at ${url}. Check it is running, and that the address in Settings is right — on a phone, “localhost” means the phone itself.`;

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
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 10000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('timeout', FRIENDLY_MESSAGES.timeout!);
    }
    throw new ApiError('network_error', describeNetworkFailure(apiBaseUrl));
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
