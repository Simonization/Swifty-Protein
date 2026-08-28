// Resolves which palette (bonus VII.2 "Dark Mode") the app renders with, from
// the persisted setting — see ../settings/settings.ts. Lives inside
// SettingsProvider (it reads useSettings()) and outside AuthProvider, so both
// the auth screens and the app screens see the same theme.
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { PALETTES, gradientsFor, type ColorScheme, type ThemeColors } from './theme';
import { useSettings } from '../settings/SettingsContext';

export interface ThemeContextValue {
  scheme: ColorScheme;
  colors: ThemeColors;
  gradients: ReturnType<typeof gradientsFor>;
}

// Exported (not just useTheme) so the one class component in the app —
// ErrorBoundary, which can't call hooks — can read it via `static contextType`.
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const scheme = settings.themeMode;

  const value = useMemo<ThemeContextValue>(() => {
    const colors = PALETTES[scheme];
    return { scheme, colors, gradients: gradientsFor(colors) };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
