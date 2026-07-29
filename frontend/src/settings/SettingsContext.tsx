// Settings state (bonus VII.2).
//
// The persisted API URL has to reach the client before anything can call the
// backend, so this provider applies it on load and on every save, and reports
// `ready` so the app can hold the splash until it has.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setApiBaseUrl } from '../api/client';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type Settings } from './settings';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  save: (next: Settings) => Promise<void>;
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await readSettings();
      setApiBaseUrl(loaded.apiBaseUrl);
      setSettings(loaded);
      setReady(true);
    })();
  }, []);

  const save = useCallback(async (next: Settings) => {
    setApiBaseUrl(next.apiBaseUrl);
    setSettings(next);
    await writeSettings(next);
  }, []);

  const reset = useCallback(() => save(DEFAULT_SETTINGS), [save]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, save, reset }),
    [settings, ready, save, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
