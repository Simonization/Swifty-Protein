// When does the app re-lock?
//
// This is the subject's hardest security rule (protein.md:196-203) and the
// evaluation sheet's "Security" gate: the Login view must ALWAYS be displayed
// on launch, on return from the background, and after the Home button — even
// if the user was previously authenticated.
//
// It lives here, apart from AuthContext, because it is the one piece of that
// state machine worth proving rather than arguing: the difference between
// "re-lock on every background event" and "re-lock on every background event
// except the share sheet we opened ourselves" is two lines of code and the
// difference between passing and failing two different requirements.
import type { AppStateStatus } from 'react-native';

export interface LockInputs {
  /** The AppState value that just arrived. */
  next: AppStateStatus;
  /** Whether the session gate has been passed since the last lock. */
  wasUnlocked: boolean;
  /**
   * Whether the app itself handed the foreground to another activity it
   * launched — currently only the share chooser. Android reports that as a
   * real 'background', indistinguishable from the Home button at this level,
   * which is why the caller marks it rather than this function guessing.
   */
  excursion: boolean;
}

export function shouldRelock({ next, wasUnlocked, excursion }: LockInputs): boolean {
  // 'inactive' is deliberately not a trigger. iOS raises it for the share
  // sheet, Control Centre and notification banners; re-locking on it ejected
  // the user to Login mid-share, breaking mandatory VI.4 as well as VI.2.
  if (next !== 'background') return false;
  if (!wasUnlocked) return false;
  return !excursion;
}
