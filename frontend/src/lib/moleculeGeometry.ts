// Pure geometry/grouping logic for the instanced MoleculeViewer renderer.
//
// No `three` import on purpose: this is the index-mapping logic that makes
// InstancedMesh picking correct (instanceId -> atom/bond), and it's the only
// part of the instancing rewrite with a real test loop without a device, so
// it stays plain-number-tuple math that jest can exercise directly.
import { elementFor } from '../data/elements';
import type { Atom, Bond } from '../types';

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
