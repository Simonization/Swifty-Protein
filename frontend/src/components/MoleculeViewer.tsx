import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { Atom, Ligand } from '../types';

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
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const ROTATE_SPEED = 0.008;
const PAN_SPEED = 0.0025;
const CENTER_ANIM_MS = 450;
const HIGHLIGHT_EMISSIVE = 0x2a2a2a;
const MEASURE_EMISSIVE = 0x5c4400;
const MEASURE_LINE_COLOR = 0xffd54a;

// Shared: a Raycaster keeps no state between setFromCamera calls and picking is
// synchronous, so one instance serves every tap.
const raycaster = new THREE.Raycaster();

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
  function MoleculeViewer({ ligand, mode, showLabels, measureMode, onSelectionChange }, ref) {
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

    const atomMeshesRef = useRef<THREE.Mesh[]>([]);
    const bondMeshesRef = useRef<THREE.Mesh[]>([]);
    const wireframeRef = useRef<THREE.LineSegments | null>(null);
    const measurePointsRef = useRef<{ mesh: THREE.Mesh; pos: THREE.Vector3 }[]>([]);
    const measureLineRef = useRef<THREE.LineSegments | null>(null);
    const disposeRef = useRef<(() => void) | null>(null);
    const showLabelsRef = useRef(showLabels);

    const [labelPositions, setLabelPositions] = useState<
      { id: number; x: number; y: number; symbol: string; color: string }[]
    >([]);

    useEffect(() => {
      showLabelsRef.current = showLabels;
    }, [showLabels]);

    // With labels on, the render loop re-renders this component ~15x/sec. The
    // gesture objects and the imperative handle below are therefore built once
    // and read anything volatile through this ref, so a label frame doesn't
    // rebuild the whole gesture tree.
    const latest = useRef({ measureMode, onSelectionChange });
    latest.current = { measureMode, onSelectionChange };

    const applyMode = (nextMode: ViewMode) => {
      const atomsVisible = nextMode !== 'wireframe';
      for (const mesh of atomMeshesRef.current) {
        mesh.visible = atomsVisible;
        if (!atomsVisible) continue;
        mesh.scale.setScalar(atomScaleFor(nextMode, elementFor(mesh.userData.atom.element).radius));
      }
      const bondsVisible = nextMode === 'ballStick' || nextMode === 'stick';
      const radius = bondRadiusFor(nextMode);
      for (const mesh of bondMeshesRef.current) {
        mesh.visible = bondsVisible;
        mesh.scale.set(radius, mesh.userData.halfLength as number, radius);
      }
      if (wireframeRef.current) wireframeRef.current.visible = nextMode === 'wireframe';
    };

    useEffect(() => {
      applyMode(mode);
    }, [mode]);

    const clearMeasurement = useCallback(() => {
      for (const { mesh } of measurePointsRef.current) {
        (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      }
      measurePointsRef.current = [];
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

    const highlightElement = (symbol: string | null) => {
      for (const mesh of atomMeshesRef.current) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(symbol && mesh.userData.atom.element === symbol ? HIGHLIGHT_EMISSIVE : 0x000000);
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

    const handleMeasureTap = (mesh: THREE.Mesh) => {
      if (measurePointsRef.current.length >= 3) clearMeasurement();
      if (measurePointsRef.current.some((p) => p.mesh === mesh)) return;

      (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(MEASURE_EMISSIVE);
      measurePointsRef.current.push({ mesh, pos: mesh.position.clone() });
      rebuildMeasureLine();

      const pts = measurePointsRef.current;
      const measurement: MeasurementInfo = {
        points: pts.map(({ mesh: m }) => {
          const atom = m.userData.atom as AtomTapInfo;
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

    // Gesture coordinates arrive in dp and sizeRef is dp, so the whole pick
    // stays in one coordinate system.
    const pickAt = (x: number, y: number, meshes: THREE.Mesh[]): THREE.Intersection | undefined => {
      const camera = cameraRef.current;
      if (!camera) return undefined;
      const { width, height } = sizeRef.current;
      raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera);
      // intersectObjects() never checks `.visible` itself, so meshes hidden by
      // the current view mode (e.g. bonds in Wireframe) must be filtered out
      // here or they'd stay tappable while invisible.
      return raycaster.intersectObjects(meshes.filter((m) => m.visible))[0];
    };

    const handleSingleTap = (x: number, y: number) => {
      const hit = pickAt(x, y, [...atomMeshesRef.current, ...bondMeshesRef.current])?.object as
        | THREE.Mesh
        | undefined;
      const { measureMode: measuring, onSelectionChange: select } = latest.current;

      if (measuring) {
        if (hit?.userData.atom) handleMeasureTap(hit);
        return;
      }

      if (hit?.userData.atom) {
        const atom = hit.userData.atom as AtomTapInfo;
        highlightElement(atom.element);
        select({ kind: 'atom', atom });
      } else if (hit?.userData.bond) {
        highlightElement(null);
        select({ kind: 'bond', bond: hit.userData.bond as BondTapInfo });
      } else {
        highlightElement(null);
        select(null);
      }
    };

    const handleDoubleTap = (x: number, y: number) => {
      const hit = pickAt(x, y, atomMeshesRef.current);
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

      const center = new THREE.Vector3();
      for (const atom of ligand.atoms) center.add(new THREE.Vector3(atom.x, atom.y, atom.z));
      if (ligand.atoms.length > 0) center.divideScalar(ligand.atoms.length);

      // Each atom with its centred position, keyed by id: bonds reference atoms
      // by id rather than by array index, and the bond loop below needs both.
      let maxDist = 1;
      const byId = new Map<number, { atom: Atom; pos: THREE.Vector3 }>();
      for (const atom of ligand.atoms) {
        const pos = new THREE.Vector3(atom.x, atom.y, atom.z).sub(center);
        byId.set(atom.id, { atom, pos });
        maxDist = Math.max(maxDist, pos.length());
      }
      baseDistance.current = Math.max(maxDist * 2.6, 4);
      applyCamera();

      const sphereGeom = new THREE.SphereGeometry(1, 20, 16);
      const cylinderGeom = new THREE.CylinderGeometry(1, 1, 1, 10);
      const materialCache = new Map<string, THREE.MeshStandardMaterial>();
      const materialFor = (hex: string) => {
        let mat = materialCache.get(hex);
        if (!mat) {
          mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(`#${hex}`), roughness: 0.4, metalness: 0.1 });
          materialCache.set(hex, mat);
        }
        return mat;
      };

      const atomMeshes: THREE.Mesh[] = [];
      for (const atom of ligand.atoms) {
        const el = elementFor(atom.element);
        const mesh = new THREE.Mesh(sphereGeom, materialFor(el.cpkHex).clone());
        mesh.position.copy(byId.get(atom.id)!.pos);
        // Scale is applyMode's alone -- see the applyMode(mode) call below.
        // atom.element, not el.symbol: the parser already canonicalises to "Cl",
        // where the table's key is the uppercase "CL" it is looked up by. This is
        // what labels and the tooltip display, and what bond info already uses.
        mesh.userData.atom = { id: atom.id, element: atom.element, name: atom.name, x: atom.x, y: atom.y, z: atom.z };
        group.add(mesh);
        atomMeshes.push(mesh);
      }
      atomMeshesRef.current = atomMeshes;

      const bondMeshes: THREE.Mesh[] = [];
      const wireframePositions: number[] = [];
      const wireframeColors: number[] = [];
      const pushWireColor = (hex: string) => {
        const c = new THREE.Color(`#${hex}`);
        wireframeColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      };

      for (const bond of ligand.bonds) {
        const a = byId.get(bond.a);
        const b = byId.get(bond.b);
        if (!a || !b) continue;
        const dir = new THREE.Vector3().subVectors(b.pos, a.pos);
        const length = dir.length();
        if (length < 1e-6) continue;
        const mid = new THREE.Vector3().addVectors(a.pos, b.pos).multiplyScalar(0.5);
        const colorA = elementFor(a.atom.element).cpkHex;
        const colorB = elementFor(b.atom.element).cpkHex;
        const half = length / 2;
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        const bondInfo: BondTapInfo = {
          order: bond.order,
          aromatic: !!bond.aromatic,
          length,
          a: { element: a.atom.element, name: a.atom.name },
          b: { element: b.atom.element, name: b.atom.name },
        };

        // Two half-cylinders, each in its own atom's colour. Their radius and
        // length come from applyMode via userData.halfLength.
        const meshA = new THREE.Mesh(cylinderGeom, materialFor(colorA));
        meshA.quaternion.copy(quat);
        meshA.position.copy(a.pos).addScaledVector(dir, 0.25);
        meshA.userData.bond = bondInfo;
        meshA.userData.halfLength = half;
        group.add(meshA);
        bondMeshes.push(meshA);

        const meshB = new THREE.Mesh(cylinderGeom, materialFor(colorB));
        meshB.quaternion.copy(quat);
        meshB.position.copy(mid).addScaledVector(dir, 0.25);
        meshB.userData.bond = bondInfo;
        meshB.userData.halfLength = half;
        group.add(meshB);
        bondMeshes.push(meshB);

        wireframePositions.push(a.pos.x, a.pos.y, a.pos.z, mid.x, mid.y, mid.z);
        pushWireColor(colorA);
        wireframePositions.push(mid.x, mid.y, mid.z, b.pos.x, b.pos.y, b.pos.z);
        pushWireColor(colorB);
      }
      bondMeshesRef.current = bondMeshes;

      const wireGeom = new THREE.BufferGeometry();
      wireGeom.setAttribute('position', new THREE.Float32BufferAttribute(wireframePositions, 3));
      wireGeom.setAttribute('color', new THREE.Float32BufferAttribute(wireframeColors, 3));
      const wireMat = new THREE.LineBasicMaterial({ vertexColors: true });
      const wireframeLines = new THREE.LineSegments(wireGeom, wireMat);
      wireframeLines.visible = false;
      group.add(wireframeLines);
      wireframeRef.current = wireframeLines;

      applyMode(mode);

      let frameCount = 0;
      let labelsShown = false;
      const renderLoop = () => {
        frameCount++;
        group.rotation.x = rotation.current.x;
        group.rotation.y = rotation.current.y;
        updatePanAnimation();
        applyCamera();
        renderer.render(scene, camera);
        gl.endFrameEXP();

        if (showLabelsRef.current && frameCount % 4 === 0) {
          const { width: w, height: h } = sizeRef.current;
          const next: { id: number; x: number; y: number; symbol: string; color: string }[] = [];
          for (const mesh of atomMeshes) {
            if (!mesh.visible) continue;
            const v = mesh.position.clone().applyMatrix4(group.matrixWorld).project(camera);
            if (v.z > 1) continue;
            const sx = (v.x * 0.5 + 0.5) * w;
            const sy = (-v.y * 0.5 + 0.5) * h;
            if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
            const atom = mesh.userData.atom as AtomTapInfo;
            next.push({ id: atom.id, x: sx, y: sy, symbol: atom.element, color: elementFor(atom.element).cpkHex });
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
        atomMeshes.forEach((m) => (m.material as THREE.Material).dispose());
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

    return (
      <GestureDetector gesture={composed}>
        <View style={styles.fill} onLayout={onLayout}>
          <GLView ref={glViewRef} style={styles.fill} onContextCreate={onContextCreate} />
          {labelPositions.map((label) => (
            <Text
              key={label.id}
              pointerEvents="none"
              style={[styles.label, { left: label.x - 10, top: label.y - 8, color: `#${label.color}` }]}
            >
              {label.symbol}
            </Text>
          ))}
        </View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  label: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
