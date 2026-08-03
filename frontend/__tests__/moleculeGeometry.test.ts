import {
  MAX_ATOMS,
  MAX_BONDS,
  buildHalfBonds,
  exceedsRenderLimits,
  groupAtomIndicesByElement,
  groupHalfBondIndicesByColor,
  layoutAtoms,
  lodFor,
  type HalfBondSpec,
} from '../src/lib/moleculeGeometry';
import type { Atom, Bond } from '../src/types';

const atom = (id: number, element: string, x: number, y: number, z: number): Atom => ({
  id,
  element,
  name: element + id,
  x,
  y,
  z,
});

describe('layoutAtoms', () => {
  it('centers atoms on their centroid and reports the farthest distance', () => {
    const atoms = [atom(1, 'C', 0, 0, 0), atom(2, 'C', 4, 0, 0), atom(3, 'C', 2, 3, 0)];
    const { positions, maxDistance } = layoutAtoms(atoms);

    // centroid of the three raw points is (2, 1, 0); every position is
    // raw - centroid, so their sum (and hence average) must land on origin.
    const sum = positions.reduce<[number, number, number]>(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
      [0, 0, 0]
    );
    expect(sum[0]).toBeCloseTo(0);
    expect(sum[1]).toBeCloseTo(0);
    expect(sum[2]).toBeCloseTo(0);

    const expectedMax = Math.max(...positions.map(([x, y, z]) => Math.sqrt(x * x + y * y + z * z)));
    expect(maxDistance).toBeCloseTo(expectedMax);
  });

  it('floors maxDistance at 1 for a single atom at the origin', () => {
    expect(layoutAtoms([atom(1, 'C', 0, 0, 0)]).maxDistance).toBe(1);
  });
});

describe('buildHalfBonds', () => {
  it('matches the original per-bond math for a simple two-atom bond', () => {
    const atoms = [atom(1, 'C', 0, 0, 0), atom(2, 'O', 2, 0, 0)];
    const bonds: Bond[] = [{ a: 1, b: 2, order: 1 }];
    const { positions } = layoutAtoms(atoms);

    const specs = buildHalfBonds(atoms, bonds, positions);
    expect(specs).toHaveLength(2);

    const [halfA, halfB] = specs;
    expect(halfA.bondIndex).toBe(0);
    expect(halfB.bondIndex).toBe(0);
    expect(halfA.halfLength).toBeCloseTo(1);
    expect(halfB.halfLength).toBeCloseTo(1);
    expect(halfA.position[0]).toBeCloseTo(-0.5);
    expect(halfA.position[1]).toBeCloseTo(0);
    expect(halfA.position[2]).toBeCloseTo(0);
    expect(halfB.position[0]).toBeCloseTo(0.5);
    expect(halfB.position[1]).toBeCloseTo(0);
    expect(halfB.position[2]).toBeCloseTo(0);
    expect(halfA.colorHex).toBe('909090'); // carbon
    expect(halfB.colorHex).toBe('FF0D0D'); // oxygen
  });

  it('skips a bond referencing an atom id not present in this ligand', () => {
    const atoms = [atom(1, 'C', 0, 0, 0)];
    const bonds: Bond[] = [{ a: 1, b: 99, order: 1 }];
    const { positions } = layoutAtoms(atoms);

    expect(buildHalfBonds(atoms, bonds, positions)).toHaveLength(0);
  });

  it('skips a zero-length bond between coincident atoms', () => {
    const atoms = [atom(1, 'C', 0, 0, 0), atom(2, 'O', 0, 0, 0)];
    const bonds: Bond[] = [{ a: 1, b: 2, order: 1 }];
    const { positions } = layoutAtoms(atoms);

    expect(buildHalfBonds(atoms, bonds, positions)).toHaveLength(0);
  });
});

describe('groupAtomIndicesByElement', () => {
  it('partitions every atom index into exactly one group', () => {
    const atoms = [atom(1, 'Cl', 0, 0, 0), atom(2, 'CL', 0, 0, 0), atom(3, 'Cl', 0, 0, 0), atom(4, 'O', 0, 0, 0)];
    const groups = groupAtomIndicesByElement(atoms);

    const flat = groups.flatMap((g) => g.indices).sort((a, b) => a - b);
    expect(flat).toEqual([0, 1, 2, 3]);

    // "Cl" and "CL" are distinct raw parser strings and must not merge --
    // same-element highlighting compares this raw string.
    const cl = groups.find((g) => g.element === 'Cl');
    const CL = groups.find((g) => g.element === 'CL');
    expect(cl?.indices).toEqual([0, 2]);
    expect(CL?.indices).toEqual([1]);
  });
});

describe('groupHalfBondIndicesByColor', () => {
  it('partitions every half-bond spec index into exactly one group', () => {
    const specs: HalfBondSpec[] = [
      { bondIndex: 0, position: [0, 0, 0], axis: [1, 0, 0], halfLength: 1, colorHex: 'AAA' },
      { bondIndex: 0, position: [0, 0, 0], axis: [1, 0, 0], halfLength: 1, colorHex: 'BBB' },
      { bondIndex: 1, position: [0, 0, 0], axis: [1, 0, 0], halfLength: 1, colorHex: 'AAA' },
      { bondIndex: 1, position: [0, 0, 0], axis: [1, 0, 0], halfLength: 1, colorHex: 'CCC' },
    ];
    const groups = groupHalfBondIndicesByColor(specs);

    const flat = groups.flatMap((g) => g.indices).sort((a, b) => a - b);
    expect(flat).toEqual([0, 1, 2, 3]);
    expect(groups.find((g) => g.colorHex === 'AAA')?.indices).toEqual([0, 2]);
  });
});

describe('lodFor', () => {
  it('keeps the original fixed segment counts up to 200 atoms', () => {
    expect(lodFor(200)).toEqual({ sphereWidthSegments: 20, sphereHeightSegments: 16, cylinderRadialSegments: 10 });
  });

  it('steps down past 200', () => {
    expect(lodFor(201)).toEqual({ sphereWidthSegments: 14, sphereHeightSegments: 10, cylinderRadialSegments: 8 });
    expect(lodFor(600)).toEqual({ sphereWidthSegments: 14, sphereHeightSegments: 10, cylinderRadialSegments: 8 });
  });

  it('steps down again past 600', () => {
    expect(lodFor(601)).toEqual({ sphereWidthSegments: 10, sphereHeightSegments: 8, cylinderRadialSegments: 6 });
  });
});

describe('exceedsRenderLimits', () => {
  it('allows exactly the documented caps', () => {
    expect(exceedsRenderLimits(MAX_ATOMS, 0)).toBe(false);
    expect(exceedsRenderLimits(0, MAX_BONDS)).toBe(false);
  });

  it('rejects one atom or bond past the cap', () => {
    expect(exceedsRenderLimits(MAX_ATOMS + 1, 0)).toBe(true);
    expect(exceedsRenderLimits(0, MAX_BONDS + 1)).toBe(true);
  });
});
