// The runtime API base URL (bonus VII.2). EXPO_PUBLIC_API_URL is inlined at
// build time, so this override is what lets a built app reach a backend that
// isn't on the machine that built it.
import { DEFAULT_API_BASE_URL, getApiBaseUrl, setApiBaseUrl } from '../src/api/client';

afterEach(() => {
  setApiBaseUrl(DEFAULT_API_BASE_URL);
});

describe('api base url', () => {
  it('defaults to the build-time value', () => {
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });

  it('applies an override', () => {
    setApiBaseUrl('http://192.168.1.20:3000');
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:3000');
  });

  it('strips a trailing slash so paths do not double up', () => {
    setApiBaseUrl('http://192.168.1.20:3000/');
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:3000');
  });

  it('trims surrounding whitespace from a pasted url', () => {
    setApiBaseUrl('  http://192.168.1.20:3000  ');
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:3000');
  });

  it('falls back to the default rather than an empty base', () => {
    setApiBaseUrl('   ');
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });
});
