import { VIEW_MODES, isViewMode } from '../src/data/viewModes';

describe('isViewMode', () => {
  it('accepts every declared mode key', () => {
    for (const mode of VIEW_MODES) {
      expect(isViewMode(mode.key)).toBe(true);
    }
  });

  it('rejects unknown or malformed values (used to coerce a persisted setting)', () => {
    expect(isViewMode('spinny')).toBe(false);
    expect(isViewMode(undefined)).toBe(false);
    expect(isViewMode(null)).toBe(false);
    expect(isViewMode(42)).toBe(false);
  });
});
