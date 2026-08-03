import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ErrorBanner } from './ErrorBanner';
import { colors, spacing, typography } from '../theme/theme';
import { elementFor } from '../data/elements';
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
} from '../lib/moleculeGeometry';
import type { Ligand } from '../types';

export type ViewMode = 'ballStick' | 'spaceFilling' | 'wireframe' | 'stick';

export interface AtomTapInfo {
  id: number;
  element: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface BondTapInfo {
  order: 1 | 2 | 3;
  aromatic: boolean;
  length: number;
  a: { element: string; name: string };
  b: { element: string; name: string };
}

export interface MeasurementInfo {
  points: { element: string; name: string }[];
  distance?: number;
  angleDeg?: number;
}

// Reported to the screen when a ligand is refused for being past the render
// limits, so it can say *how far* past rather than just "too big".
export interface TooLargeInfo {
  atoms: number;
  bonds: number;
  maxAtoms: number;
  maxBonds: number;
}

// What the viewer currently has selected. At most one of these can be true at a
// time -- a tap in measure mode never selects an atom or a bond, and leaving
// measure mode clears the measurement -- so it is one value, not three.
export type Selection =
  | { kind: 'atom'; atom: AtomTapInfo }
  | { kind: 'bond'; bond: BondTapInfo }
  | { kind: 'measurement'; measurement: MeasurementInfo };

export interface MoleculeViewerHandle {
  captureSnapshot: () => Promise<string | null>;
}

interface MoleculeViewerProps {
  ligand: Ligand;
  mode: ViewMode;
  showLabels: boolean;
  measureMode: boolean;
  onSelectionChange: (selection: Selection | null) => void;
  onTooLarge?: (info: TooLargeInfo) => void;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const ROTATE_SPEED = 0.008;
const PAN_SPEED = 0.0025;
const CENTER_ANIM_MS = 450;
const HIGHLIGHT_EMISSIVE = 0x2a2a2a;
const MEASURE_EMISSIVE = 0x5c4400;
const MEASURE_LINE_COLOR = 0xffd54a;

// A measurement is a distance (2 atoms) or an angle (3), so three overlay
// spheres are all that can ever be lit at once -- see the measure slot pool in
// onContextCreate for why this is a fixed pool rather than per-atom state.
const MEASURE_SLOTS = 3;
// The overlay sphere has to *enclose* the instanced atom underneath it, or
// z-fighting would show through in patches. 5% is enough to win the depth test
// everywhere while still reading as the same sphere.
const MEASURE_OVERLAY_SCALE = 1.05;

// Shared: a Raycaster keeps no state between setFromCamera calls and picking is
// synchronous, so one instance serves every tap.
const raycaster = new THREE.Raycaster();

// Same reasoning as `raycaster`, but for the hot paths: the label projection
// runs once per atom per label frame and applyMode composes one matrix per
// instance. Allocating a Vector3/Matrix4 in either would hand the GC a few
// thousand short-lived objects a second on a big ligand.
const scratchVec = new THREE.Vector3();
const scratchScale = new THREE.Vector3();
const scratchQuat = new THREE.Quaternion();
const scratchMatrix = new THREE.Matrix4();
const NO_ROTATION = new THREE.Quaternion();
const CYLINDER_AXIS = new THREE.Vector3(0, 1, 0);

// One InstancedMesh per distinct element (atoms) / per distinct CPK colour
// (bond halves). Grouping this way -- rather than one mesh for everything with
// a per-instance colour attribute -- is what keeps same-element highlighting a
// single material tweak (see highlightElement) instead of a custom shader.
interface AtomGroup {
  element: string;
  atomIndices: number[]; // instanceId -> flat atom index; the same array lives in mesh.userData
  mesh: THREE.InstancedMesh;
}

interface BondGroup {
  halfIndices: number[]; // instanceId -> index into the half-bond spec array
  mesh: THREE.InstancedMesh;
}

// Per-mode atom/bond visuals — VII.1: switching modes never touches the
// underlying geometry, only scale/visibility, so it's instant either way.
// Wireframe draws no atom spheres at all, so it has no atom scale.
function atomScaleFor(mode: Exclude<ViewMode, 'wireframe'>, elementRadius: number): number {
  switch (mode) {
    case 'ballStick':
      return elementRadius * 0.28;
    case 'spaceFilling':
      return elementRadius;
    case 'stick':
      return 0.14;
  }
}

function bondRadiusFor(mode: ViewMode): number {
  return mode === 'stick' ? 0.11 : 0.09;
}

export const MoleculeViewer = forwardRef<MoleculeViewerHandle, MoleculeViewerProps>(
  function MoleculeViewer({ ligand, mode, showLabels, measureMode, onSelectionChange, onTooLarge }, ref) {
    const glViewRef = useRef<GLView>(null);
    // Layout dp, never physical pixels: gesture coordinates arrive in dp and the
    // label offsets below are dp. Written by onLayout, and once by
    // onContextCreate if it somehow runs first -- but always in dp.
    const sizeRef = useRef({ width: 1, height: 1 });
    const rendererRef = useRef<Renderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const groupRef = useRef<THREE.Group | null>(null);
    const rafRef = useRef<number | null>(null);

    const rotation = useRef({ x: -0.35, y: 0.5 });
    const zoom = useRef(1);
    const savedZoom = useRef(1);
    const pan = useRef({ x: 0, y: 0 });
    const panAnimation = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; start: number } | null>(
      null
    );
    const baseDistance = useRef(10);

    // Refusing a ligand outright is cheaper than every guard downstream having
    // to cope with a half-built scene, so this is decided before anything GL
    // exists and the GLView simply never mounts.
    const tooLarge = exceedsRenderLimits(ligand.atoms.length, ligand.bonds.length);
    const tooLargeRef = useRef(tooLarge);
    tooLargeRef.current = tooLarge;

    const atomGroupsRef = useRef<AtomGroup[]>([]);
    const bondGroupsRef = useRef<BondGroup[]>([]);
    // Flat, index-aligned scene data. Picking resolves an instanceId to an index
    // into these; nothing about an atom or a bond is stored on a mesh any more.
    const atomInfosRef = useRef<AtomTapInfo[]>([]);
    const atomPositionsRef = useRef<THREE.Vector3[]>([]);
    const halfBondsRef = useRef<HalfBondSpec[]>([]);
    const halfPositionsRef = useRef<THREE.Vector3[]>([]);
    const halfQuaternionsRef = useRef<THREE.Quaternion[]>([]);
    // Indexed by ligand.bonds index; holes for bonds that were skipped as
    // invalid (unknown endpoint / coincident atoms), which draw nothing either.
    const bondInfosRef = useRef<(BondTapInfo | undefined)[]>([]);
    const wireframeRef = useRef<THREE.LineSegments | null>(null);
    const measureSlotsRef = useRef<THREE.Mesh[]>([]);
    const measurePointsRef = useRef<{ atomIndex: number; pos: THREE.Vector3 }[]>([]);
    const measureLineRef = useRef<THREE.LineSegments | null>(null);
    const disposeRef = useRef<(() => void) | null>(null);
    const showLabelsRef = useRef(showLabels);
    // applyMode is the only writer; everything else that needs the live mode
    // (measure overlay scaling, the label loop's atoms-hidden check) reads it.
    const modeRef = useRef<ViewMode>(mode);

    const [labelPositions, setLabelPositions] = useState<
      { id: number; x: number; y: number; symbol: string; color: string }[]
    >([]);
    const [stats, setStats] = useState<{ fps: number; calls: number } | null>(null);

    useEffect(() => {
      showLabelsRef.current = showLabels;
    }, [showLabels]);

    // With labels on, the render loop re-renders this component ~15x/sec. The
    // gesture objects and the imperative handle below are therefore built once
    // and read anything volatile through this ref, so a label frame doesn't
    // rebuild the whole gesture tree.
    const latest = useRef({ measureMode, onSelectionChange, onTooLarge });
    latest.current = { measureMode, onSelectionChange, onTooLarge };

    // Only on the counts, never on the (usually inline, so per-render new)
    // callback: depending on the callback identity would re-alert on every
    // parent render.
    useEffect(() => {
      if (!tooLarge) return;
      latest.current.onTooLarge?.({
        atoms: ligand.atoms.length,
        bonds: ligand.bonds.length,
        maxAtoms: MAX_ATOMS,
        maxBonds: MAX_BONDS,
      });
    }, [tooLarge, ligand.atoms.length, ligand.bonds.length]);

    // Re-scales and re-shows whichever overlay spheres are currently measuring.
    // Called on every mode switch and after every measure tap so the overlay
    // tracks the instanced atom it encloses.
    const syncMeasureSlots = (nextMode: ViewMode) => {
      const atomsVisible = nextMode !== 'wireframe';
      measureSlotsRef.current.forEach((slot, slotIndex) => {
        const point = measurePointsRef.current[slotIndex];
        if (!point) {
          slot.visible = false;
          return;
        }
        slot.visible = atomsVisible;
        if (!atomsVisible) return;
        const radius = elementFor(atomInfosRef.current[point.atomIndex].element).radius;
        slot.position.copy(point.pos);
        slot.scale.setScalar(atomScaleFor(nextMode, radius) * MEASURE_OVERLAY_SCALE);
      });
    };

    const applyMode = (nextMode: ViewMode) => {
      modeRef.current = nextMode;

      const atomsVisible = nextMode !== 'wireframe';
      for (const group of atomGroupsRef.current) {
        group.mesh.visible = atomsVisible;
        // Wireframe has no atom scale at all, so a hidden group keeps whatever
        // matrices it last had. Safe: it is neither drawn nor picked (pickAt
        // filters on .visible) and the next visible mode rewrites all of them.
        if (!atomsVisible) continue;
        scratchScale.setScalar(atomScaleFor(nextMode, elementFor(group.element).radius));
        group.atomIndices.forEach((atomIndex, instanceId) => {
          scratchMatrix.compose(atomPositionsRef.current[atomIndex], NO_ROTATION, scratchScale);
          group.mesh.setMatrixAt(instanceId, scratchMatrix);
        });
        group.mesh.instanceMatrix.needsUpdate = true;
        // Mandatory after any instanceMatrix rewrite: InstancedMesh.raycast and
        // the frustum check both reuse a bounding sphere computed from whatever
        // scale happened to be active the first time, and nothing invalidates
        // it. Skip this and switching to Space-filling leaves picking and
        // culling working off the much smaller Ball & stick bounds.
        group.mesh.computeBoundingSphere();
      }

      const bondsVisible = nextMode === 'ballStick' || nextMode === 'stick';
      const radius = bondRadiusFor(nextMode);
      for (const group of bondGroupsRef.current) {
        group.mesh.visible = bondsVisible;
        if (!bondsVisible) continue;
        group.halfIndices.forEach((halfIndex, instanceId) => {
          scratchScale.set(radius, halfBondsRef.current[halfIndex].halfLength, radius);
          scratchMatrix.compose(
            halfPositionsRef.current[halfIndex],
            halfQuaternionsRef.current[halfIndex],
            scratchScale
          );
          group.mesh.setMatrixAt(instanceId, scratchMatrix);
        });
        group.mesh.instanceMatrix.needsUpdate = true;
        group.mesh.computeBoundingSphere();
      }

      if (wireframeRef.current) wireframeRef.current.visible = nextMode === 'wireframe';
      syncMeasureSlots(nextMode);
    };

    useEffect(() => {
      applyMode(mode);
    }, [mode]);

    const clearMeasurement = useCallback(() => {
      measurePointsRef.current = [];
      for (const slot of measureSlotsRef.current) slot.visible = false;
      if (measureLineRef.current) {
        groupRef.current?.remove(measureLineRef.current);
        measureLineRef.current.geometry.dispose();
        (measureLineRef.current.material as THREE.Material).dispose();
        measureLineRef.current = null;
      }
      latest.current.onSelectionChange(null);
    }, []);

    useEffect(() => {
      if (!measureMode) clearMeasurement();
    }, [measureMode, clearMeasurement]);

    // Sharing is the only thing the screen needs to reach in for; the
    // measurement clears itself when measureMode goes false.
    useImperativeHandle(
      ref,
      () => ({
        captureSnapshot: async () => {
          // No GLView is mounted for a refused ligand, so there is nothing to
          // snapshot -- report that rather than reaching for a null ref.
          if (tooLargeRef.current) return null;
          // Expo GL defaults to JPEG; the share call declares image/png, so ask for PNG.
          const snapshot = await glViewRef.current?.takeSnapshotAsync({
            flip: false,
            format: 'png',
          });
          return typeof snapshot?.uri === 'string' ? snapshot.uri : null;
        },
      }),
      [],
    );

    useEffect(() => {
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        disposeRef.current?.();
      };
    }, []);

    const applyCamera = () => {
      const camera = cameraRef.current;
      if (!camera) return;
      camera.position.set(pan.current.x, pan.current.y, baseDistance.current / zoom.current);
      camera.lookAt(pan.current.x, pan.current.y, 0);
    };

    const updatePanAnimation = () => {
      const anim = panAnimation.current;
      if (!anim) return;
      const t = Math.min(1, (Date.now() - anim.start) / CENTER_ANIM_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      pan.current.x = anim.from.x + (anim.to.x - anim.from.x) * eased;
      pan.current.y = anim.from.y + (anim.to.y - anim.from.y) * eased;
      if (t >= 1) panAnimation.current = null;
    };

    // One material per element group, so lighting up every carbon is one
    // emissive write. Atom groups own *cloned* materials (see onContextCreate)
    // precisely so this loop can't reach a bond that shares the same CPK colour.
    const highlightElement = (symbol: string | null) => {
      for (const group of atomGroupsRef.current) {
        const mat = group.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(symbol && group.element === symbol ? HIGHLIGHT_EMISSIVE : 0x000000);
      }
    };

    const rebuildMeasureLine = () => {
      if (measureLineRef.current) {
        groupRef.current?.remove(measureLineRef.current);
        measureLineRef.current.geometry.dispose();
        (measureLineRef.current.material as THREE.Material).dispose();
        measureLineRef.current = null;
      }
      const pts = measurePointsRef.current;
      if (pts.length < 2 || !groupRef.current) return;
      const positions: number[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].pos.x, pts[i].pos.y, pts[i].pos.z, pts[i + 1].pos.x, pts[i + 1].pos.y, pts[i + 1].pos.z);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: MEASURE_LINE_COLOR }));
      groupRef.current.add(line);
      measureLineRef.current = line;
    };

    // Measure highlighting is per *atom*, and an InstancedMesh has no
    // per-instance emissive without a custom shader. So instead of touching the
    // instance buffers at all, a measured atom gets one of three pre-built
    // overlay spheres parked on top of it in its own colour -- same look as the
    // old per-mesh emissive, zero coupling to the instancing.
    const handleMeasureTap = (atomIndex: number) => {
      if (measurePointsRef.current.length >= MEASURE_SLOTS) clearMeasurement();
      if (measurePointsRef.current.some((p) => p.atomIndex === atomIndex)) return;

      const slot = measureSlotsRef.current[measurePointsRef.current.length];
      if (!slot) return;
      const info = atomInfosRef.current[atomIndex];
      const mat = slot.material as THREE.MeshStandardMaterial;
      mat.color.set(`#${elementFor(info.element).cpkHex}`);
      mat.emissive.setHex(MEASURE_EMISSIVE);

      measurePointsRef.current.push({ atomIndex, pos: atomPositionsRef.current[atomIndex].clone() });
      syncMeasureSlots(modeRef.current);
      rebuildMeasureLine();

      const pts = measurePointsRef.current;
      const measurement: MeasurementInfo = {
        points: pts.map((p) => {
          const atom = atomInfosRef.current[p.atomIndex];
          return { element: atom.element, name: atom.name };
        }),
      };
      if (pts.length === 2) {
        measurement.distance = pts[0].pos.distanceTo(pts[1].pos);
      } else if (pts.length === 3) {
        const v1 = new THREE.Vector3().subVectors(pts[0].pos, pts[1].pos);
        const v2 = new THREE.Vector3().subVectors(pts[2].pos, pts[1].pos);
        measurement.angleDeg = THREE.MathUtils.radToDeg(v1.angleTo(v2));
      }
      latest.current.onSelectionChange({ kind: 'measurement', measurement });
    };

    // An InstancedMesh hit reports the whole group as `object` plus an
    // `instanceId`, so the group's build-time index array is what turns that
    // back into an atom or a bond.
    const resolvePick = (
      hit: THREE.Intersection
    ): { kind: 'atom'; atomIndex: number } | { kind: 'bond'; bondIndex: number } | null => {
      const instanceId = hit.instanceId;
      if (instanceId == null) return null;
      const data = hit.object.userData as {
        kind?: 'atomGroup' | 'bondGroup';
        atomIndices?: number[];
        halfIndices?: number[];
      };
      if (data.kind === 'atomGroup') {
        const atomIndex = data.atomIndices?.[instanceId];
        return atomIndex === undefined ? null : { kind: 'atom', atomIndex };
      }
      if (data.kind === 'bondGroup') {
        const halfIndex = data.halfIndices?.[instanceId];
        if (halfIndex === undefined) return null;
        const spec = halfBondsRef.current[halfIndex];
        return spec ? { kind: 'bond', bondIndex: spec.bondIndex } : null;
      }
      return null;
    };

    // Gesture coordinates arrive in dp and sizeRef is dp, so the whole pick
    // stays in one coordinate system.
    const pickAt = (x: number, y: number, meshes: THREE.InstancedMesh[]): THREE.Intersection | undefined => {
      const camera = cameraRef.current;
      if (!camera) return undefined;
      const { width, height } = sizeRef.current;
      raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera);
      // intersectObjects() never checks `.visible` itself, so groups hidden by
      // the current view mode (e.g. bonds in Wireframe) must be filtered out
      // here or they'd stay tappable while invisible.
      return raycaster.intersectObjects(meshes.filter((m) => m.visible))[0];
    };

    const handleSingleTap = (x: number, y: number) => {
      const hit = pickAt(x, y, [
        ...atomGroupsRef.current.map((g) => g.mesh),
        ...bondGroupsRef.current.map((g) => g.mesh),
      ]);
      const picked = hit ? resolvePick(hit) : null;
      const { measureMode: measuring, onSelectionChange: select } = latest.current;

      if (measuring) {
        if (picked?.kind === 'atom') handleMeasureTap(picked.atomIndex);
        return;
      }

      if (picked?.kind === 'atom') {
        const atom = atomInfosRef.current[picked.atomIndex];
        highlightElement(atom.element);
        select({ kind: 'atom', atom });
        return;
      }

      const bond = picked?.kind === 'bond' ? bondInfosRef.current[picked.bondIndex] : undefined;
      highlightElement(null);
      select(bond ? { kind: 'bond', bond } : null);
    };

    const handleDoubleTap = (x: number, y: number) => {
      const hit = pickAt(
        x,
        y,
        atomGroupsRef.current.map((g) => g.mesh)
      );
      if (!hit) return;
      panAnimation.current = {
        from: { ...pan.current },
        to: { x: hit.point.x, y: hit.point.y },
        start: Date.now(),
      };
    };

    // Built once: every handler here reads refs (including `latest` for props),
    // so there is no stale closure to rebuild for.
    const composed = useMemo(() => {
      const panOneFinger = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onChange((e) => {
          rotation.current.y += e.changeX * ROTATE_SPEED;
          rotation.current.x = Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, rotation.current.x + e.changeY * ROTATE_SPEED)
          );
        });

      const panTwoFinger = Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .onChange((e) => {
          const scale = baseDistance.current / zoom.current;
          pan.current.x -= e.changeX * PAN_SPEED * scale;
          pan.current.y += e.changeY * PAN_SPEED * scale;
        });

      const pinch = Gesture.Pinch()
        .onUpdate((e) => {
          zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedZoom.current * e.scale));
        })
        .onEnd(() => {
          savedZoom.current = zoom.current;
        });

      const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((e, success) => {
          if (success) handleDoubleTap(e.x, e.y);
        });

      const singleTap = Gesture.Tap()
        .numberOfTaps(1)
        .requireExternalGestureToFail(doubleTap)
        .onEnd((e, success) => {
          if (success) handleSingleTap(e.x, e.y);
        });

      return Gesture.Simultaneous(panOneFinger, panTwoFinger, pinch, doubleTap, singleTap);
    }, []);

    const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
      // A GL surface cannot exist before its view is laid out, so onLayout has
      // normally already put the dp size in sizeRef. Preferring it, and deriving
      // the ratio from it, keeps buffer and layout consistent by construction --
      // where PixelRatio.get() is only *assumed* to match the GL buffer.
      //
      // But don't stake the whole viewer on that ordering: if layout somehow has
      // not landed, fall back to the screen scale. A slightly wrong ratio is
      // recoverable on the next layout; a 1x1 viewport is a black screen.
      const laidOut = sizeRef.current.width > 1 && sizeRef.current.height > 1;
      const pixelRatio = laidOut ? gl.drawingBufferWidth / sizeRef.current.width : PixelRatio.get();
      const width = laidOut ? sizeRef.current.width : gl.drawingBufferWidth / pixelRatio;
      const height = laidOut ? sizeRef.current.height : gl.drawingBufferHeight / pixelRatio;
      // Keep the invariant that matters: sizeRef is dp, whichever path set it.
      sizeRef.current = { width, height };

      const renderer = new Renderer({ gl, width, height, pixelRatio, clearColor: colors.bg });
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      cameraRef.current = camera;

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(4, 6, 8);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x88bbff, 0.4);
      fill.position.set(-6, -2, -4);
      scene.add(fill);

      const group = new THREE.Group();
      scene.add(group);
      groupRef.current = group;

      // All of the layout maths lives in lib/moleculeGeometry so it can be
      // unit-tested without a GL context; everything below is scene assembly.
      const { positions, maxDistance } = layoutAtoms(ligand.atoms);
      baseDistance.current = Math.max(maxDistance * 2.6, 4);
      applyCamera();

      const atomPositions = positions.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      atomPositionsRef.current = atomPositions;
      // atom.element, not elementFor(...).symbol: the parser already
      // canonicalises to "Cl", where the table's key is the uppercase "CL" it is
      // looked up by. This is what labels, the tooltip and bond info display,
      // and what the element groups below are keyed on.
      const atomInfos: AtomTapInfo[] = ligand.atoms.map((atom) => ({
        id: atom.id,
        element: atom.element,
        name: atom.name,
        x: atom.x,
        y: atom.y,
        z: atom.z,
      }));
      atomInfosRef.current = atomInfos;

      // Segment counts drop for very large ligands; at the sizes this app
      // actually ships (B12, 180 atoms) the profile is identical to the old
      // fixed 20/16/10, so nothing visible changes.
      const lod = lodFor(ligand.atoms.length);
      const sphereGeom = new THREE.SphereGeometry(1, lod.sphereWidthSegments, lod.sphereHeightSegments);
      const cylinderGeom = new THREE.CylinderGeometry(1, 1, 1, lod.cylinderRadialSegments);
      const materialCache = new Map<string, THREE.MeshStandardMaterial>();
      const materialFor = (hex: string) => {
        let mat = materialCache.get(hex);
        if (!mat) {
          mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(`#${hex}`), roughness: 0.4, metalness: 0.1 });
          materialCache.set(hex, mat);
        }
        return mat;
      };

      // Atom groups take a *clone* of the cached material -- highlightElement
      // writes emissive on it, and a shared instance would make highlighting
      // carbon light up every grey bond half as well. Bond groups (below) have
      // no highlight state, so they share the cache instance.
      const atomGroups: AtomGroup[] = groupAtomIndicesByElement(ligand.atoms).map(({ element, indices }) => {
        const mesh = new THREE.InstancedMesh(
          sphereGeom,
          materialFor(elementFor(element).cpkHex).clone(),
          indices.length
        );
        // Rewritten in full on every mode switch.
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // The very same array the instances are laid out from, so instanceId k
        // maps back to exactly the atom instance k was built from.
        mesh.userData = { kind: 'atomGroup', atomIndices: indices };
        group.add(mesh);
        return { element, atomIndices: indices, mesh };
      });
      atomGroupsRef.current = atomGroups;

      const halfBonds = buildHalfBonds(ligand.atoms, ligand.bonds, positions);
      halfBondsRef.current = halfBonds;
      halfPositionsRef.current = halfBonds.map((spec) => new THREE.Vector3(...spec.position));
      // Orientation never changes with the view mode, so the unit-vector
      // rotation is solved once here rather than per mode switch.
      halfQuaternionsRef.current = halfBonds.map((spec) =>
        new THREE.Quaternion().setFromUnitVectors(CYLINDER_AXIS, new THREE.Vector3(...spec.axis))
      );

      const atomById = new Map(ligand.atoms.map((atom) => [atom.id, atom]));
      const bondInfos: (BondTapInfo | undefined)[] = new Array(ligand.bonds.length);
      for (const spec of halfBonds) {
        if (bondInfos[spec.bondIndex]) continue;
        const bond = ligand.bonds[spec.bondIndex];
        const a = atomById.get(bond.a);
        const b = atomById.get(bond.b);
        if (!a || !b) continue;
        bondInfos[spec.bondIndex] = {
          order: bond.order,
          aromatic: !!bond.aromatic,
          length: spec.halfLength * 2,
          a: { element: a.element, name: a.name },
          b: { element: b.element, name: b.name },
        };
      }
      bondInfosRef.current = bondInfos;

      const bondGroups: BondGroup[] = groupHalfBondIndicesByColor(halfBonds).map(({ colorHex, indices }) => {
        const mesh = new THREE.InstancedMesh(cylinderGeom, materialFor(colorHex), indices.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData = { kind: 'bondGroup', halfIndices: indices };
        group.add(mesh);
        return { halfIndices: indices, mesh };
      });
      bondGroupsRef.current = bondGroups;

      // Wireframe is drawn from the same half-bond specs as the cylinders, so
      // the two modes can never disagree about where a bond's midpoint is: a
      // half's segment runs from its own atom to the midpoint, which is its
      // centre +/- half of its own half-length along the bond axis.
      const wireframePositions: number[] = [];
      const wireframeColors: number[] = [];
      for (const spec of halfBonds) {
        const [px, py, pz] = spec.position;
        const [ax, ay, az] = spec.axis;
        const reach = spec.halfLength / 2;
        wireframePositions.push(px - ax * reach, py - ay * reach, pz - az * reach);
        wireframePositions.push(px + ax * reach, py + ay * reach, pz + az * reach);
        const c = new THREE.Color(`#${spec.colorHex}`);
        wireframeColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      const wireGeom = new THREE.BufferGeometry();
      wireGeom.setAttribute('position', new THREE.Float32BufferAttribute(wireframePositions, 3));
      wireGeom.setAttribute('color', new THREE.Float32BufferAttribute(wireframeColors, 3));
      const wireMat = new THREE.LineBasicMaterial({ vertexColors: true });
      const wireframeLines = new THREE.LineSegments(wireGeom, wireMat);
      wireframeLines.visible = false;
      group.add(wireframeLines);
      wireframeRef.current = wireframeLines;

      // Measure overlay pool: three real (non-instanced) spheres, built once and
      // parked invisible. Their material is per-slot because each takes the
      // colour of whatever atom it is currently sitting on.
      const measureSlots: THREE.Mesh[] = [];
      for (let i = 0; i < MEASURE_SLOTS; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
        const slot = new THREE.Mesh(sphereGeom, mat);
        slot.visible = false;
        group.add(slot);
        measureSlots.push(slot);
      }
      measureSlotsRef.current = measureSlots;

      applyMode(mode);

      let frameCount = 0;
      let labelsShown = false;
      let statFrames = 0;
      let statSince = Date.now();
      const renderLoop = () => {
        frameCount++;
        group.rotation.x = rotation.current.x;
        group.rotation.y = rotation.current.y;
        updatePanAnimation();
        applyCamera();
        // Future work: skipping render when nothing moved would save power, but
        // it needs a device to confirm endFrameEXP's buffer-swap semantics don't
        // flash a stale/blank buffer, so it stays unconditional for now.
        renderer.render(scene, camera);
        gl.endFrameEXP();

        if (__DEV__) {
          statFrames++;
          const elapsed = Date.now() - statSince;
          if (elapsed >= 1000) {
            // renderer.info.render.calls is reset by each render() call, so this
            // is the draw-call count of the frame just drawn.
            setStats({ fps: Math.round((statFrames * 1000) / elapsed), calls: renderer.info.render.calls });
            statFrames = 0;
            statSince = Date.now();
          }
        }

        if (showLabelsRef.current && frameCount % 4 === 0) {
          const { width: w, height: h } = sizeRef.current;
          const next: { id: number; x: number; y: number; symbol: string; color: string }[] = [];
          // Wireframe draws no spheres, so it gets no labels either -- same as
          // the old per-mesh `if (!mesh.visible) continue`.
          if (modeRef.current !== 'wireframe') {
            for (let i = 0; i < atomPositions.length; i++) {
              const v = scratchVec.copy(atomPositions[i]).applyMatrix4(group.matrixWorld).project(camera);
              if (v.z > 1) continue;
              const sx = (v.x * 0.5 + 0.5) * w;
              const sy = (-v.y * 0.5 + 0.5) * h;
              if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
              const atom = atomInfos[i];
              next.push({ id: atom.id, x: sx, y: sy, symbol: atom.element, color: elementFor(atom.element).cpkHex });
            }
          }
          setLabelPositions(next);
          labelsShown = true;
        } else if (!showLabelsRef.current && labelsShown) {
          setLabelPositions([]);
          labelsShown = false;
        }

        rafRef.current = requestAnimationFrame(renderLoop);
      };
      renderLoop();

      disposeRef.current = () => {
        sphereGeom.dispose();
        cylinderGeom.dispose();
        wireGeom.dispose();
        wireMat.dispose();
        materialCache.forEach((mat) => mat.dispose());
        // InstancedMesh.dispose() releases the instance attribute buffers, which
        // disposing the shared geometry and material does not cover.
        for (const { mesh } of atomGroups) {
          (mesh.material as THREE.Material).dispose(); // the per-group clone
          mesh.dispose();
        }
        for (const { mesh } of bondGroups) mesh.dispose(); // material is the shared cache instance
        for (const slot of measureSlots) (slot.material as THREE.Material).dispose();
        // Unmounting mid-measurement used to leak this one.
        const line = measureLineRef.current;
        if (line) {
          group.remove(line);
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measureLineRef.current = null;
        }
        renderer.dispose();
      };
    };

    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      sizeRef.current = { width, height };
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (camera && renderer) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    };

    if (tooLarge) {
      return (
        <View style={[styles.fill, styles.fallback]}>
          <ErrorBanner
            message={`This ligand has ${ligand.atoms.length} atoms and ${ligand.bonds.length} bonds, past the ${MAX_ATOMS} atom / ${MAX_BONDS} bond limit this viewer can render.`}
          />
        </View>
      );
    }

    return (
      <GestureDetector gesture={composed}>
        <View style={styles.fill} onLayout={onLayout}>
          <GLView
            ref={glViewRef}
            style={styles.fill}
            onContextCreate={onContextCreate}
            accessibilityRole="image"
            accessibilityLabel={`3D model of ${ligand.id}, ${ligand.atoms.length} atoms and ${ligand.bonds.length} bonds`}
            accessibilityHint="Drag to rotate, pinch to zoom, two fingers to pan, tap an atom for its details"
          />
          {labelPositions.map((label) => (
            // Decorative: these repeat the element symbols the tooltip already
            // reads out, and there are one per atom.
            <Text
              key={label.id}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              style={[styles.label, { left: label.x - 10, top: label.y - 8, color: `#${label.color}` }]}
            >
              {label.symbol}
            </Text>
          ))}
          {__DEV__ && stats && (
            // Dev-only evidence that instancing landed: draw calls should be one
            // per element group plus one per bond colour (~8-16), not one per
            // atom. Never shipped, never announced.
            <Text pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.stats}>
              {`${stats.fps} fps · ${stats.calls} draw calls`}
            </Text>
          )}
        </View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  fallback: { justifyContent: 'center', paddingHorizontal: spacing(4) },
  label: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  stats: {
    position: 'absolute',
    top: spacing(2),
    left: spacing(2),
    ...typography.caption,
    color: colors.textFaint,
    backgroundColor: 'rgba(10, 14, 23, 0.6)',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.5),
    borderRadius: 4,
  },
});
