// Central auth state machine. Statuses:
//   bootstrapping -> checking secure storage on cold start
//   signedOut     -> no session on this device; show full Login/Register
//   locked        -> a session exists but the app is gated (cold start with a
//                     saved session, OR returning from background) — the
//                     subject's "Login View must ALWAYS be displayed" rule
//   unlocked      -> session gate passed; app content is visible
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as authApi from '../api/auth';
import { ApiError } from '../api/client';
import type { User } from '../api/auth';
import { checkBiometricSupport, authenticateWithBiometrics, type BiometricCheck } from './biometrics';
import { clearSession, loadSession, saveSession } from './storage';

type Status = 'bootstrapping' | 'signedOut' | 'locked' | 'unlocked';

interface AuthState {
  status: Status;
  user: User | null;
  token: string | null;
  biometrics: BiometricCheck;
}

interface AuthContextValue extends AuthState {
  register: (username: string, password: string) => Promise<void>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'bootstrapping',
    user: null,
    token: null,
    biometrics: { available: false, label: 'Biometrics' },
  });
  // Tracks whether the *current* session gate has ever been passed, so the
  // AppState listener knows whether backgrounding should re-lock.
  const wasUnlocked = useRef(false);

  useEffect(() => {
    (async () => {
      const [session, biometrics] = await Promise.all([loadSession(), checkBiometricSupport()]);
      setState((s) => ({
        ...s,
        status: session ? 'locked' : 'signedOut',
        user: session?.user ?? null,
        token: session?.token ?? null,
        biometrics,
      }));
    })();
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active' && wasUnlocked.current) {
        wasUnlocked.current = false;
        setState((s) => (s.status === 'unlocked' ? { ...s, status: 'locked' } : s));
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const unlock = useCallback((user: User, token: string) => {
    wasUnlocked.current = true;
    setState((s) => ({ ...s, status: 'unlocked', user, token }));
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.register(username, password);
      await saveSession(token, user);
      unlock(user, token);
    },
    [unlock],
  );

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.login(username, password);
      await saveSession(token, user);
      unlock(user, token);
    },
    [unlock],
  );

  // Re-gates access to the already-stored session without hitting the network.
  const unlockWithBiometrics = useCallback(async () => {
    const label = state.biometrics.label;
    const result = await authenticateWithBiometrics(`Unlock Swifty Protein with ${label}`);
    if (result.success && state.user && state.token) {
      unlock(state.user, state.token);
    }
    return result;
  }, [state.biometrics.label, state.user, state.token, unlock]);

  const logout = useCallback(async () => {
    await clearSession();
    wasUnlocked.current = false;
    setState((s) => ({ ...s, status: 'signedOut', user: null, token: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, register, loginWithPassword, unlockWithBiometrics, logout }),
    [state, register, loginWithPassword, unlockWithBiometrics, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function describeAuthError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
