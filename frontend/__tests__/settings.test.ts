import { File, Paths } from 'expo-file-system';

import { DEFAULT_SETTINGS, isValidApiUrl, readSettings, writeSettings } from '../src/settings/settings';

describe('isValidApiUrl', () => {
  it('accepts http and https urls', () => {
    expect(isValidApiUrl('http://192.168.1.20:3000')).toBe(true);
    expect(isValidApiUrl('https://example.com')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidApiUrl('ftp://example.com')).toBe(false);
    expect(isValidApiUrl('not a url')).toBe(false);
    expect(isValidApiUrl('')).toBe(false);
  });
});

// jest-expo's FileSystem mock is in-memory but shared across the whole file, so
// without this the "before anything has been saved" case only passes while it
// happens to run first. Clearing the file makes each case independent.
describe('readSettings / writeSettings', () => {
  beforeEach(() => {
    try {
      const file = new File(Paths.document, 'settings.json');
      if (file.exists) file.delete();
    } catch {
      // Nothing written yet; that is the state we wanted anyway.
    }
  });

  it('returns the defaults before anything has been saved', async () => {
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a written settings object', async () => {
    const custom = {
      apiBaseUrl: 'http://192.168.1.20:3000',
      defaultMode: 'spaceFilling' as const,
      showLabelsByDefault: true,
      themeMode: 'light' as const,
      onboardingSeen: true,
    };
    await writeSettings(custom);
    expect(await readSettings()).toEqual(custom);
  });

  it('coerces a missing themeMode to dark, so an existing install sees no change', async () => {
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'http://host:3000', defaultMode: 'stick', showLabelsByDefault: false })
    );
    expect((await readSettings()).themeMode).toBe('dark');
  });

  it('coerces an unrecognised themeMode back to the default', async () => {
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'http://host:3000', defaultMode: 'stick', themeMode: 'sepia' })
    );
    expect((await readSettings()).themeMode).toBe(DEFAULT_SETTINGS.themeMode);
  });

  it('coerces a missing onboardingSeen to false, so the tour is offered once', async () => {
    // Settings written by a build before onboarding existed must not skip it.
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'http://host:3000', defaultMode: 'stick', showLabelsByDefault: false })
    );
    expect((await readSettings()).onboardingSeen).toBe(false);
  });

  it('falls back entirely on corrupt (non-JSON) content', async () => {
    new File(Paths.document, 'settings.json').write('{not json');
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('coerces an invalid apiBaseUrl back to the default, keeping the rest', async () => {
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'not a url', defaultMode: 'stick', showLabelsByDefault: true })
    );
    const settings = await readSettings();
    expect(settings.apiBaseUrl).toBe(DEFAULT_SETTINGS.apiBaseUrl);
    expect(settings.defaultMode).toBe('stick');
    expect(settings.showLabelsByDefault).toBe(true);
  });

  it('coerces an unrecognised defaultMode back to the default', async () => {
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'http://host:3000', defaultMode: 'spinny', showLabelsByDefault: false })
    );
    expect((await readSettings()).defaultMode).toBe(DEFAULT_SETTINGS.defaultMode);
  });

  it('coerces a non-boolean showLabelsByDefault back to the default', async () => {
    new File(Paths.document, 'settings.json').write(
      JSON.stringify({ apiBaseUrl: 'http://host:3000', defaultMode: 'wireframe', showLabelsByDefault: 'yes' })
    );
    expect((await readSettings()).showLabelsByDefault).toBe(DEFAULT_SETTINGS.showLabelsByDefault);
  });
});
