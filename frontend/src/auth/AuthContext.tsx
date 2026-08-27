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
import { nextRelockState, INITIAL_RELOCK_STATE, type RelockState } from './lockPolicy';

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
  // Runs `fn` without letting the resulting background event re-lock the app.
  // For foreground handoffs the app initiates itself — currently the share sheet.
  runWithoutRelock: <T>(fn: () => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'bootstrapping',
    user: null,
    token: null,
    biometrics: { available: false, label: 'Biometrics' },
  });
  // Tracks whether the *current* session gate has ever been passed, whether an
  // excursion (share sheet, biometric prompt) is open, and when a background
  // event was last excused by one — the whole state the AppState listener
  // needs. Gathered into one value, updated only through nextRelockState, so
  // the full event sequence is what's tested (auth/lockPolicy.ts), not just
  // the two predicates it combines in isolation.
  const relockState = useRef<RelockState>({ ...INITIAL_RELOCK_STATE });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Neither of these rejects any more (see auth/storage and auth/biometrics),
      // but the guard stays: if bootstrap ever throws, `status` never leaves
      // 'bootstrapping' and RootNavigator holds the splash screen forever.
      let session: Awaited<ReturnType<typeof loadSession>> = null;
      let biometrics: BiometricCheck = { available: false, label: 'Biometrics' };
      try {
        [session, biometrics] = await Promise.all([loadSession(), checkBiometricSupport()]);
      } catch {
        // Fall through to signedOut with biometrics unavailable — the password
        // path is always reachable, so the app is usable rather than stuck.
      }
      if (cancelled) return;
      setState((s) => ({
        ...s,
        status: session ? 'locked' : 'signedOut',
        user: session?.user ?? null,
        token: session?.token ?? null,
        biometrics,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      // The decision itself is in auth/lockPolicy, where the full event
      // sequence is unit-tested — this is the requirement the evaluation
      // sheet checks by pressing Home and reopening the app.
      const { state, relock } = nextRelockState(relockState.current, next, Date.now());
      relockState.current = state;
      if (relock) {
        setState((s) => (s.status === 'unlocked' ? { ...s, status: 'locked' } : s));
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // Wraps a call that hands the foreground to another activity we launched
  // ourselves, so returning from it does not read as the user leaving the app.
  const runWithoutRelock = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    relockState.current.excursion = true;
    try {
      return await fn();
    } finally {
      // A late 'active' event clears this too; this is the fast path for the
      // case where the OS never actually backgrounded us (e.g. iOS sharing,
      // which is a same-process modal and never touches AppState). Short,
      // because excursion staying true any longer than the native transition
      // needs widens the window for an unrelated later backgrounding to be
      // wrongly excused by a stale flag.
      setTimeout(() => {
        relockState.current.excursion = false;
      }, 500);
    }
  }, []);

  const unlock = useCallback((user: User, token: string) => {
    relockState.current.wasUnlocked = true;
    setState((s) => ({ ...s, status: 'unlocked', user, token }));
  }, []);

  // A failed write must never reject an authentication the server already
  // granted. It used to: saveSession threw, register() rejected, and the screen
  // said "Something went wrong" about an account that had just been created --
  // so trying again answered "username already taken". Persistence only decides
  // whether the *next* cold start can offer biometric unlock instead of the
  // password, and the subject requires the Login view on every launch anyway.
  const persistSession = useCallback(async (token: string, user: User) => {
    try {
      await saveSession(token, user);
    } catch {
      // Keychain/Keystore unavailable. The session lives in state for this run.
    }
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.register(username, password);
      await persistSession(token, user);
      unlock(user, token);
    },
    [unlock, persistSession],
  );

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.login(username, password);
      await persistSession(token, user);
      unlock(user, token);
    },
    [unlock, persistSession],
  );

  // Re-gates access to the already-stored session without hitting the network.
  const unlockWithBiometrics = useCallback(async () => {
    const label = state.biometrics.label;
    // Some Android face-unlock implementations run in their own activity.
    const result = await runWithoutRelock(() =>
      authenticateWithBiometrics(`Unlock Swifty Protein with ${label}`),
    );
    if (result.success && state.user && state.token) {
      unlock(state.user, state.token);
    }
    return result;
  }, [state.biometrics.label, state.user, state.token, unlock, runWithoutRelock]);

  const logout = useCallback(async () => {
    await clearSession();
    relockState.current.wasUnlocked = false;
    setState((s) => ({ ...s, status: 'signedOut', user: null, token: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, register, loginWithPassword, unlockWithBiometrics, logout, runWithoutRelock }),
    [state, register, loginWithPassword, unlockWithBiometrics, logout, runWithoutRelock],
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
