// User settings (bonus VII.2): what they are, and how they persist.
//
// Stored as JSON in the document directory rather than the cache directory --
// the system may purge the cache, and losing the server URL would strand the
// app. SecureStore is for the session; none of this is secret.
import { File, Paths } from 'expo-file-system';

import { DEFAULT_API_BASE_URL } from '../api/client';
import { isViewMode } from '../data/viewModes';
import type { ViewMode } from '../components/MoleculeViewer';

export interface Settings {
  // Where the auth backend lives. Overridable because the build-time default
  // points at the device itself. See ../api/client.ts.
  apiBaseUrl: string;
  defaultMode: ViewMode;
  showLabelsByDefault: boolean;
  // Whether the first-run tour has been dismissed (bonus VII.2 onboarding).
  // Lives here rather than in its own file so there is one thing to clear.
  onboardingSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  defaultMode: 'ballStick',
  showLabelsByDefault: false,
  onboardingSeen: false,
};

export const isValidApiUrl = (url: string): boolean => /^https?:\/\/\S+$/i.test(url.trim());

const FILE_NAME = 'settings.json';

const settingsFile = (): File => new File(Paths.document, FILE_NAME);

// Anything unrecognised falls back to its default, so a hand-edited or
// half-written file degrades to defaults instead of crashing the app.
function coerce(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    apiBaseUrl:
      typeof value.apiBaseUrl === 'string' && isValidApiUrl(value.apiBaseUrl)
        ? value.apiBaseUrl
        : DEFAULT_SETTINGS.apiBaseUrl,
    defaultMode: isViewMode(value.defaultMode) ? value.defaultMode : DEFAULT_SETTINGS.defaultMode,
    showLabelsByDefault:
      typeof value.showLabelsByDefault === 'boolean'
        ? value.showLabelsByDefault
        : DEFAULT_SETTINGS.showLabelsByDefault,
    onboardingSeen:
      typeof value.onboardingSeen === 'boolean'
        ? value.onboardingSeen
        : DEFAULT_SETTINGS.onboardingSeen,
  };
}

export async function readSettings(): Promise<Settings> {
  try {
    const file = settingsFile();
    if (!file.exists) return DEFAULT_SETTINGS;
    return coerce(JSON.parse(await file.text()));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  const file = settingsFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(settings, null, 2));
}
