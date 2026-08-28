import {
  nextFpsGuardState,
  INITIAL_FPS_GUARD_STATE,
  LOW_FPS_THRESHOLD,
  LOW_FPS_STRIKES_TO_DEGRADE,
} from '../src/lib/frameQuality';

describe('nextFpsGuardState', () => {
  it('does nothing while fps stays at or above the threshold', () => {
    let state = INITIAL_FPS_GUARD_STATE;
    for (let i = 0; i < 10; i++) {
      const { state: next, shouldDegrade } = nextFpsGuardState(state, LOW_FPS_THRESHOLD, true);
      expect(shouldDegrade).toBe(false);
      state = next;
    }
    expect(state).toEqual(INITIAL_FPS_GUARD_STATE);
  });

  it('does nothing while labels are already off — nothing to shed', () => {
    let state = INITIAL_FPS_GUARD_STATE;
    for (let i = 0; i < 10; i++) {
      const { state: next, shouldDegrade } = nextFpsGuardState(state, 1, false);
      expect(shouldDegrade).toBe(false);
      state = next;
    }
    expect(state.degraded).toBe(false);
  });

  it('a single bad sample does not degrade — only sustained slowness does', () => {
    const { state, shouldDegrade } = nextFpsGuardState(INITIAL_FPS_GUARD_STATE, LOW_FPS_THRESHOLD - 1, true);
    expect(shouldDegrade).toBe(false);
    expect(state.strikes).toBe(1);
    expect(state.degraded).toBe(false);
  });

  it('degrades exactly once, on the Nth consecutive bad sample', () => {
    let state = INITIAL_FPS_GUARD_STATE;
    const results: boolean[] = [];
    for (let i = 0; i < LOW_FPS_STRIKES_TO_DEGRADE + 2; i++) {
      const result = nextFpsGuardState(state, 10, true);
      results.push(result.shouldDegrade);
      state = result.state;
    }
    // shouldDegrade is true on exactly the strike that crosses the threshold,
    // and false on every sample before and after it.
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[LOW_FPS_STRIKES_TO_DEGRADE - 1]).toBe(true);
    expect(state.degraded).toBe(true);
  });

  it('a good sample in between resets the strike count', () => {
    let state = nextFpsGuardState(INITIAL_FPS_GUARD_STATE, 10, true).state;
    state = nextFpsGuardState(state, 10, true).state;
    expect(state.strikes).toBe(2);
    // One good frame in the middle of an otherwise-bad run must not carry
    // over — real slowness is sustained, not "2 bad, 1 good, 2 bad".
    state = nextFpsGuardState(state, 60, true).state;
    expect(state.strikes).toBe(0);
  });

  it('never re-triggers or un-degrades once degraded', () => {
    let state: import('../src/lib/frameQuality').FpsGuardState = { strikes: 0, degraded: true };
    for (const fps of [1, 200, 44, 45]) {
      const result = nextFpsGuardState(state, fps, true);
      expect(result.shouldDegrade).toBe(false);
      expect(result.state.degraded).toBe(true);
      state = result.state;
    }
  });
});
