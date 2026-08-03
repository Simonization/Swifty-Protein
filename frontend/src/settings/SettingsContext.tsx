// Settings state (bonus VII.2).
//
// The persisted API URL has to reach the client before anything can call the
// backend, so this provider applies it on load and on every save, and reports
// `ready` so the app can hold the splash until it has.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { setApiBaseUrl } from '../api/client';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type Settings } from './settings';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  // Partial, and merged over the current value: the Settings screen only knows
  // about the fields it renders, and must not clear the ones it doesn't
  // (onboardingSeen).
  save: (next: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await readSettings();
        setApiBaseUrl(loaded.apiBaseUrl);
        setSettings(loaded);
      } catch {
        // Defaults are already in state. The one thing that must happen either
        // way is `ready`: RootNavigator holds the splash screen until it flips,
        // so an escape here would strand the app on the splash forever.
      }
      setReady(true);
    })();
  }, []);

  // Mirrors `settings` so `save` can merge against the current value without
  // taking it as a dependency — the callback stays stable, and a save issued
  // from a stale render still writes the whole, current object.
  const latest = useRef(settings);
  latest.current = settings;

  const save = useCallback(async (patch: Partial<Settings>) => {
    const merged = { ...latest.current, ...patch };
    latest.current = merged;
    setApiBaseUrl(merged.apiBaseUrl);
    setSettings(merged);
    await writeSettings(merged);
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
