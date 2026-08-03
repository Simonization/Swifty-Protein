// Camera framing (mandatory VI.4: "initial camera position should show the
// entire molecule").
//
// The bug this pins: the old formula was `maxDistance * 2.6`, which fits the
// molecule vertically. The viewer pane is much taller than it is wide, so on a
// phone in portrait the outer atoms of a wide ligand were clipped off the left
// and right edges. These are pure functions precisely so the fix is provable
// without a GL context.
import { boundingRadiusFor, frameDistance } from '../src/lib/moleculeGeometry';

// 45 degree vertical FOV, so a sphere of radius R fits vertically at
// R / tan(22.5 deg) = R * 2.4142.
const FIT_VERTICAL = 1 / Math.tan((45 / 2) * (Math.PI / 180));

// What half-extent is actually visible at distance d, on each axis.
const visibleHalfHeight = (d: number) => d / FIT_VERTICAL;
const visibleHalfWidth = (d: number, aspect: number) => visibleHalfHeight(d) * aspect;

describe('frameDistance', () => {
  it('fits the molecule on a square viewport', () => {
    const d = frameDistance(10, 1);
    expect(visibleHalfHeight(d)).toBeGreaterThanOrEqual(10);
    expect(visibleHalfWidth(d, 1)).toBeGreaterThanOrEqual(10);
  });

  it('fits the molecule horizontally on a tall (portrait) viewport', () => {
    // ~342x545dp, the real viewer pane on a 390x844 phone.
    const aspect = 342 / 545;
    const d = frameDistance(10, aspect);
    expect(visibleHalfWidth(d, aspect)).toBeGreaterThanOrEqual(10);
  });

  it('fits the molecule vertically on a wide (landscape) viewport', () => {
    const aspect = 800 / 300;
    const d = frameDistance(10, aspect);
    expect(visibleHalfHeight(d)).toBeGreaterThanOrEqual(10);
  });

  it('is the fix: the old vertical-only formula clipped a portrait viewport', () => {
    const aspect = 342 / 545;
    const old = Math.max(10 * 2.6, 4);
    expect(visibleHalfWidth(old, aspect)).toBeLessThan(10); // the defect
    expect(visibleHalfWidth(frameDistance(10, aspect), aspect)).toBeGreaterThanOrEqual(10);
  });

  it('pulls back further as the viewport gets narrower', () => {
    expect(frameDistance(10, 0.4)).toBeGreaterThan(frameDistance(10, 0.8));
    expect(frameDistance(10, 0.8)).toBeGreaterThan(frameDistance(10, 1));
  });

  it('never sits closer than the near-plane floor, however small the molecule', () => {
    expect(frameDistance(0, 1)).toBeGreaterThanOrEqual(4);
    expect(frameDistance(0.001, 1)).toBeGreaterThanOrEqual(4);
  });

  it('survives a viewport that has not been measured yet', () => {
    // width/height is NaN before the first onLayout, and 0/0 on a collapsed view.
    expect(Number.isFinite(frameDistance(10, NaN))).toBe(true);
    expect(Number.isFinite(frameDistance(10, 0))).toBe(true);
  });
});

describe('boundingRadiusFor', () => {
  const maxCenter = 5;
  const vdw = 2; // roughly sulfur

  it('adds the drawn sphere radius, so outer atoms are not half off-screen', () => {
    expect(boundingRadiusFor('ballStick', maxCenter, vdw)).toBeGreaterThan(maxCenter);
  });

  it('grows for space-filling, which paints atoms at full van der Waals radius', () => {
    expect(boundingRadiusFor('spaceFilling', maxCenter, vdw)).toBe(maxCenter + vdw);
    expect(boundingRadiusFor('spaceFilling', maxCenter, vdw)).toBeGreaterThan(
      boundingRadiusFor('ballStick', maxCenter, vdw)
    );
  });

  it('is exactly the atom-centre extent for wireframe, which draws no spheres', () => {
    expect(boundingRadiusFor('wireframe', maxCenter, vdw)).toBe(maxCenter);
  });

  it('means switching to space-filling re-frames further out, not the same distance', () => {
    const aspect = 0.63;
    const ballStick = frameDistance(boundingRadiusFor('ballStick', maxCenter, vdw), aspect);
    const spaceFilling = frameDistance(boundingRadiusFor('spaceFilling', maxCenter, vdw), aspect);
    expect(spaceFilling).toBeGreaterThan(ballStick);
  });
});
