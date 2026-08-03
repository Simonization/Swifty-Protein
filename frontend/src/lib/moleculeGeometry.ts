// Pure geometry/grouping logic for the instanced MoleculeViewer renderer.
//
// No `three` import on purpose: this is the index-mapping logic that makes
// InstancedMesh picking correct (instanceId -> atom/bond), and it's the only
// part of the instancing rewrite with a real test loop without a device, so
// it stays plain-number-tuple math that jest can exercise directly.
import { elementFor } from '../data/elements';
import type { Atom, Bond } from '../types';
// Type-only, so nothing pulls the component (and with it expo-three/expo-gl)
// into this module or into a test that imports it.
import type { ViewMode } from '../components/MoleculeViewer';

export type Vec3 = readonly [number, number, number];

// The largest real CCD entries are a few hundred atoms (B12, the largest
// ligand in this dataset, is 180). 2000/4000 is ~10x that: it exists to
// refuse a malformed or hostile .cif, not to reject real data.
export const MAX_ATOMS = 2000;
export const MAX_BONDS = 4000;

export interface LodProfile {
  sphereWidthSegments: number;
  sphereHeightSegments: number;
  cylinderRadialSegments: number;
}

// Chosen once at load time from atom count and never changes afterwards, so
// mode switching (which only rewrites instance matrices) stays instant.
// The <=200 tier matches today's fixed segment counts exactly, so the graded
// ligands (B12 at 180 atoms included) render at unchanged quality.
export function lodFor(atomCount: number): LodProfile {
  if (atomCount <= 200) return { sphereWidthSegments: 20, sphereHeightSegments: 16, cylinderRadialSegments: 10 };
  if (atomCount <= 600) return { sphereWidthSegments: 14, sphereHeightSegments: 10, cylinderRadialSegments: 8 };
  return { sphereWidthSegments: 10, sphereHeightSegments: 8, cylinderRadialSegments: 6 };
}

export function exceedsRenderLimits(atomCount: number, bondCount: number): boolean {
  return atomCount > MAX_ATOMS || bondCount > MAX_BONDS;
}

// --- Per-mode visuals and camera framing (VII.1 + mandatory VI.4) ---

// Switching modes never touches the underlying geometry, only scale and
// visibility, so it is instant either way. Wireframe draws no atom spheres at
// all, so it has no atom scale.
export function atomScaleFor(mode: Exclude<ViewMode, 'wireframe'>, elementRadius: number): number {
  switch (mode) {
    case 'ballStick':
      return elementRadius * 0.28;
    case 'spaceFilling':
      return elementRadius;
    case 'stick':
      return 0.14;
  }
}

export function bondRadiusFor(mode: ViewMode): number {
  return mode === 'stick' ? 0.11 : 0.09;
}

// Must match the PerspectiveCamera in MoleculeViewer.
export const FOV_DEG = 45;
// The camera distance that fits a sphere of radius R vertically is
// R / TAN_HALF_FOV.
const TAN_HALF_FOV = Math.tan((FOV_DEG / 2) * (Math.PI / 180));
// A little air around the molecule so it doesn't touch the viewport edges.
const FRAME_MARGIN = 1.12;
// Never closer than this, however small the molecule — a single-atom ion would
// otherwise put the camera inside the near plane.
const MIN_DISTANCE = 4;

// The camera distance that shows the *whole* molecule in the current viewport.
//
// The previous formula (maxDistance * 2.6) fits the molecule vertically only.
// The viewer pane is much taller than it is wide — roughly 0.63 aspect on a
// phone in portrait — so the horizontal half-extent was about 0.68x the radius
// it needed, and the outer atoms of a wide ligand were clipped on first render.
// Dividing by min(1, aspect) makes the *narrower* axis the one that has to fit,
// which is the requirement: "initial camera position should show the entire
// molecule".
export function frameDistance(radius: number, aspect: number): number {
  const fitting = Number.isFinite(aspect) && aspect > 0 ? Math.min(1, aspect) : 1;
  return Math.max((radius * FRAME_MARGIN) / (TAN_HALF_FOV * fitting), MIN_DISTANCE);
}

// The molecule's bounding radius *as drawn in this mode*. Space-filling paints
// every atom at its full van der Waals radius, which sticks out well past the
// atom-centre extent `maxDistance` measures — so the framing has to grow when
// the mode does, and that is why switching modes re-frames.
export function boundingRadiusFor(
  mode: ViewMode,
  maxCenterDistance: number,
  maxAtomRadius: number,
): number {
  if (mode === 'wireframe') return maxCenterDistance;
  return maxCenterDistance + atomScaleFor(mode, maxAtomRadius);
}

export function centerOf(atoms: Atom[]): Vec3 {
  if (atoms.length === 0) return [0, 0, 0];
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const atom of atoms) {
    sx += atom.x;
    sy += atom.y;
    sz += atom.z;
  }
  return [sx / atoms.length, sy / atoms.length, sz / atoms.length];
}

// Centers every atom on the ligand's centroid (index-aligned with `atoms`)
// and reports the farthest distance from center, floored at 1 -- matching
// the original viewer's `maxDist` start value, which the camera distance
// formula (`max(maxDist * 2.6, 4)`) depends on to avoid a zero-size ligand
// putting the camera at distance 0.
export function layoutAtoms(atoms: Atom[]): { positions: Vec3[]; maxDistance: number } {
  const [cx, cy, cz] = centerOf(atoms);
  let maxDistance = 1;
  const positions: Vec3[] = atoms.map((atom) => {
    const x = atom.x - cx;
    const y = atom.y - cy;
    const z = atom.z - cz;
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist > maxDistance) maxDistance = dist;
    return [x, y, z];
  });
  return { positions, maxDistance };
}

// Grouped by the raw parser element string (e.g. "Cl"), not the uppercase
// table symbol it's looked up by -- same-element highlighting today compares
// `atom.element === symbol` on that raw string, so grouping on anything else
// would risk merging or splitting groups the highlight logic treats as
// distinct. Each atom's flat index appears in exactly one group.
export function groupAtomIndicesByElement(atoms: Atom[]): { element: string; indices: number[] }[] {
  const order: string[] = [];
  const byElement = new Map<string, number[]>();
  atoms.forEach((atom, index) => {
    let indices = byElement.get(atom.element);
    if (!indices) {
      indices = [];
      byElement.set(atom.element, indices);
      order.push(atom.element);
    }
    indices.push(index);
  });
  return order.map((element) => ({ element, indices: byElement.get(element)! }));
}

export interface HalfBondSpec {
  bondIndex: number; // index into `bonds` -- both halves of a bond share one, so they share one BondTapInfo
  position: Vec3; // centered world position of this half-cylinder's center
  axis: Vec3; // normalized a->b direction; the viewer builds a quaternion from this
  halfLength: number;
  colorHex: string; // CPK hex of this half's own atom (bonds are two-tone)
}

// Reproduces the original viewer's per-bond math exactly: skip bonds whose
// endpoints aren't in this ligand, skip zero-length bonds (coincident atoms),
// and offset each half by 0.25 * the (un-normalized) a->b vector, matching
// `mesh.position.copy(a.pos).addScaledVector(dir, 0.25)` / the `mid`-based
// twin for the second half.
export function buildHalfBonds(atoms: Atom[], bonds: Bond[], positions: Vec3[]): HalfBondSpec[] {
  const indexById = new Map<number, number>();
  atoms.forEach((atom, index) => indexById.set(atom.id, index));

  const specs: HalfBondSpec[] = [];
  bonds.forEach((bond, bondIndex) => {
    const ai = indexById.get(bond.a);
    const bi = indexById.get(bond.b);
    if (ai === undefined || bi === undefined) return;

    const [ax, ay, az] = positions[ai];
    const [bx, by, bz] = positions[bi];
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < 1e-6) return;

    const axis: Vec3 = [dx / length, dy / length, dz / length];
    const halfLength = length / 2;
    const colorA = elementFor(atoms[ai].element).cpkHex;
    const colorB = elementFor(atoms[bi].element).cpkHex;

    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    const midZ = (az + bz) / 2;

    specs.push({
      bondIndex,
      position: [ax + dx * 0.25, ay + dy * 0.25, az + dz * 0.25],
      axis,
      halfLength,
      colorHex: colorA,
    });
    specs.push({
      bondIndex,
      position: [midX + dx * 0.25, midY + dy * 0.25, midZ + dz * 0.25],
      axis,
      halfLength,
      colorHex: colorB,
    });
  });
  return specs;
}

// Grouped by CPK hex; every half-bond spec's index appears in exactly one
// group. Bonds have no highlight state, so unlike atom grouping this can
// freely merge different elements that happen to share a color.
export function groupHalfBondIndicesByColor(specs: HalfBondSpec[]): { colorHex: string; indices: number[] }[] {
  const order: string[] = [];
  const byColor = new Map<string, number[]>();
  specs.forEach((spec, index) => {
    let indices = byColor.get(spec.colorHex);
    if (!indices) {
      indices = [];
      byColor.set(spec.colorHex, indices);
      order.push(spec.colorHex);
    }
    indices.push(index);
  });
  return order.map((colorHex) => ({ colorHex, indices: byColor.get(colorHex)! }));
}
