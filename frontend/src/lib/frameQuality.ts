// Bonus VII.4 "60 FPS Guarantee": the render loop's one documented per-frame
// cost is label projection (MoleculeViewer re-renders ~15x/sec while labels
// are on). Rather than just measuring FPS and hoping, this is the decision
// logic for shedding that cost automatically when frames are chronically
// slow — kept pure and separate from the GL loop so the *decision* is
// unit-testable without a device, even though the FPS *measurement* it acts
// on still needs one to observe for real.
export const LOW_FPS_THRESHOLD = 45;
// ~3 consecutive one-second windows below threshold, not one bad frame — a
// single slow frame (a GC pause, a dropped frame from an unrelated OS
// hiccup) must not trigger this; sustained degradation should.
export const LOW_FPS_STRIKES_TO_DEGRADE = 3;

export interface FpsGuardState {
  strikes: number;
  degraded: boolean;
}

export const INITIAL_FPS_GUARD_STATE: FpsGuardState = { strikes: 0, degraded: false };

export interface FpsGuardResult {
  state: FpsGuardState;
  /** True exactly once — the transition into `degraded` — never again after. */
  shouldDegrade: boolean;
}

// Called once per FPS sample (roughly once a second). `labelsOn` scopes this
// to the one feature actually costing anything per-frame: strikes never
// accumulate while labels are already off, and once degraded, this is a
// permanent no-op for the rest of the mount (there is nothing left to shed,
// and re-enabling automatically would just re-trigger the same slowdown).
export function nextFpsGuardState(
  state: FpsGuardState,
  fps: number,
  labelsOn: boolean,
  threshold: number = LOW_FPS_THRESHOLD,
  strikesToDegrade: number = LOW_FPS_STRIKES_TO_DEGRADE,
): FpsGuardResult {
  if (state.degraded || !labelsOn || fps >= threshold) {
    return { state: { strikes: 0, degraded: state.degraded }, shouldDegrade: false };
  }
  const strikes = state.strikes + 1;
  const crossed = strikes >= strikesToDegrade;
  return { state: { strikes, degraded: crossed }, shouldDegrade: crossed };
}
