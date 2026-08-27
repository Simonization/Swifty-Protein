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
//
// shouldRelock() alone has a blind spot: it decides the instant a 'background'
// event arrives, so it cannot tell "the share sheet backgrounded us, as
// expected" apart from "the user pressed Home while the share sheet happened
// to be open". excursionReturnRequiresRelock() below closes that gap on the
// way back to 'active', using elapsed time as the signal AppState doesn't give.
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

// How long an excursion (share sheet, biometric prompt) may plausibly keep the
// app backgrounded before a later 'active' stops counting as "that excursion
// returning" and starts counting as a fresh return that needs the mandatory
// relock. Generous enough for someone to actually pick a share target; short
// enough that "background during the excursion, then press Home and wander
// off" cannot leave the app sitting unlocked indefinitely — see
// excursionReturnRequiresRelock below.
export const EXCURSION_MAX_MS = 20_000;

export interface ExcursionReturnInputs {
  /** ms timestamp when a 'background' event was excused by an open excursion, or null if none was. */
  backgroundedAt: number | null;
  /** ms timestamp "now" — the 'active' event that just arrived. */
  now: number;
  maxMs?: number;
}

// shouldRelock() decides in the instant a 'background' event arrives, using
// whatever `excursion` is at that moment — it has no way to know, later, that
// the user pressed Home *during* an excused excursion instead of finishing it.
// This is the other half of that decision, evaluated when the app returns to
// 'active': if the app sat backgrounded far longer than a share sheet or
// biometric prompt plausibly takes, this return is almost certainly the user
// reopening after Home, not the excursion completing — so it should relock
// even though the background event that started it was excused.
export function excursionReturnRequiresRelock({
  backgroundedAt,
  now,
  maxMs = EXCURSION_MAX_MS,
}: ExcursionReturnInputs): boolean {
  return backgroundedAt !== null && now - backgroundedAt > maxMs;
}

// Everything the AppState listener needs to carry between events, gathered
// into one value instead of three separately-updated refs — so the sequence
// below is the one place that combines shouldRelock and
// excursionReturnRequiresRelock, and a test can drive it event by event
// instead of only checking each predicate in isolation.
export interface RelockState {
  wasUnlocked: boolean;
  excursion: boolean;
  /** ms timestamp of a 'background' event excused by an open excursion, or null. */
  excursionBackgroundedAt: number | null;
}

export const INITIAL_RELOCK_STATE: RelockState = {
  wasUnlocked: false,
  excursion: false,
  excursionBackgroundedAt: null,
};

export interface RelockTransition {
  state: RelockState;
  /** Whether AuthContext should move an 'unlocked' session to 'locked' as a result of this event. */
  relock: boolean;
}

// The full state transition an AppState 'change' event drives: this is what
// AuthContext's listener calls on every event, and the only place that has to
// get the two rules above right in combination rather than isolation.
export function nextRelockState(state: RelockState, next: AppStateStatus, now: number): RelockTransition {
  let { wasUnlocked, excursion, excursionBackgroundedAt } = state;
  let relock = false;

  if (next === 'background' && excursion) {
    excursionBackgroundedAt = now;
  }

  if (shouldRelock({ next, wasUnlocked, excursion })) {
    wasUnlocked = false;
    relock = true;
  }

  if (next === 'active') {
    excursion = false;
    const backgroundedAt = excursionBackgroundedAt;
    excursionBackgroundedAt = null;
    // The background event that opened this excursion was excused on the
    // assumption it would return promptly. If it didn't, this 'active' is the
    // user reopening after Home, not the excursion completing.
    if (wasUnlocked && excursionReturnRequiresRelock({ backgroundedAt, now })) {
      wasUnlocked = false;
      relock = true;
    }
  }

  return { state: { wasUnlocked, excursion, excursionBackgroundedAt }, relock };
}
