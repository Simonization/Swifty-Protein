// Mandatory VI.2's security rule, and the evaluation sheet's "Security" gate.
// The corrector performs this by hand: log in, press Home, reopen the app, and
// check the Login view is back.
import { shouldRelock, excursionReturnRequiresRelock } from '../src/auth/lockPolicy';

const inputs = (over: Partial<Parameters<typeof shouldRelock>[0]> = {}) => ({
  next: 'background' as const,
  wasUnlocked: true,
  excursion: false,
  ...over,
});

describe('shouldRelock', () => {
  it('re-locks when the app is backgrounded — the Home button case', () => {
    expect(shouldRelock(inputs())).toBe(true);
  });

  it('re-locks from the app switcher, which also reports background', () => {
    expect(shouldRelock(inputs({ next: 'background' }))).toBe(true);
  });

  it('does not re-lock on inactive', () => {
    // iOS raises 'inactive' for the share sheet, Control Centre and
    // notification banners. Re-locking on it ejected the user to Login
    // mid-share, which broke mandatory VI.4 Share as well as VI.2.
    expect(shouldRelock(inputs({ next: 'inactive' }))).toBe(false);
  });

  it('does not re-lock on returning to active', () => {
    expect(shouldRelock(inputs({ next: 'active' }))).toBe(false);
  });

  it('does not re-lock a session that was never unlocked', () => {
    // Otherwise backgrounding the Login screen would "re-lock" an already
    // locked app and, worse, consume the flag a later real unlock needs.
    expect(shouldRelock(inputs({ wasUnlocked: false }))).toBe(false);
  });

  it('does not re-lock during a share sheet the app opened itself', () => {
    // Android launches the chooser as a separate activity, so it emits a real
    // 'background'. Without this the user comes back from sharing on the Login
    // screen instead of on their molecule.
    expect(shouldRelock(inputs({ excursion: true }))).toBe(false);
  });

  it('still re-locks on Home even if an excursion was never cleared, once it is', () => {
    // The excursion flag is cleared on the next 'active', so a subsequent Home
    // press must lock normally — the exemption is not sticky.
    expect(shouldRelock(inputs({ excursion: true }))).toBe(false);
    expect(shouldRelock(inputs({ excursion: false }))).toBe(true);
  });

  it('never treats an unknown AppState value as a reason to unlock', () => {
    // The union has grown before ('extension' on iOS). Anything that is not
    // 'background' simply is not a lock trigger, which fails safe.
    for (const next of ['extension', 'unknown', ''] as unknown as ('background' | 'active')[]) {
      expect(shouldRelock(inputs({ next }))).toBe(false);
    }
  });
});

// shouldRelock excuses a 'background' event the instant it arrives, using
// whatever `excursion` is at that moment — it cannot know, later, whether the
// user pressed Home *during* that excursion instead of letting it finish. This
// is the other half of that decision, checked when the app returns to 'active'.
describe('excursionReturnRequiresRelock', () => {
  it('does not require relock for a prompt return, well inside the ceiling', () => {
    expect(excursionReturnRequiresRelock({ backgroundedAt: 1_000, now: 1_000 + 3_000 })).toBe(false);
  });

  it('requires relock once the excursion outlasted how long a share sheet plausibly takes', () => {
    // The exact case: the user pressed Home mid-share, wandered off, and only
    // now reopened the app — the mandatory relock rule has to catch this.
    expect(excursionReturnRequiresRelock({ backgroundedAt: 1_000, now: 1_000 + 30_000 })).toBe(true);
  });

  it('is a no-op when no background event was ever excused', () => {
    expect(excursionReturnRequiresRelock({ backgroundedAt: null, now: 999_999 })).toBe(false);
  });

  it('respects a custom ceiling', () => {
    expect(excursionReturnRequiresRelock({ backgroundedAt: 0, now: 2_000, maxMs: 1_000 })).toBe(true);
    expect(excursionReturnRequiresRelock({ backgroundedAt: 0, now: 500, maxMs: 1_000 })).toBe(false);
  });
});
