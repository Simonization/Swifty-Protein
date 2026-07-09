import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { Ligand } from '../types';

export interface AtomTapInfo {
  element: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface MoleculeViewerHandle {
  captureSnapshot: () => Promise<string | null>;
}

interface MoleculeViewerProps {
  ligand: Ligand;
  onAtomTap: (atom: AtomTapInfo | null) => void;
}

// Ball-and-stick proportions: spheres scaled down from full van der Waals radius,
// sticks kept uniformly thin so they read clearly as "thinner than the atoms" (VI.4).
const SPHERE_SCALE = 0.28;
const BOND_RADIUS = 0.09;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const ROTATE_SPEED = 0.008;
const PAN_SPEED = 0.0025;

export const MoleculeViewer = forwardRef<MoleculeViewerHandle, MoleculeViewerProps>(
  function MoleculeViewer({ ligand, onAtomTap }, ref) {
    const glViewRef = useRef<GLView>(null);
    const sizeRef = useRef({ width: 1, height: 1 });
    const rendererRef = useRef<Renderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rafRef = useRef<number | null>(null);

    const rotation = useRef({ x: -0.35, y: 0.5 });
    const zoom = useRef(1);
    const savedZoom = useRef(1);
    const pan = useRef({ x: 0, y: 0 });
    const baseDistance = useRef(10);
    const atomMeshesRef = useRef<THREE.Mesh[]>([]);
    const selectedRef = useRef<THREE.Mesh | null>(null);
    const disposeRef = useRef<(() => void) | null>(null);

    useImperativeHandle(ref, () => ({
      captureSnapshot: async () => {
        const snapshot = await glViewRef.current?.takeSnapshotAsync({ flip: false });
        return typeof snapshot?.uri === 'string' ? snapshot.uri : null;
      },
    }));

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

    const highlight = (mesh: THREE.Mesh | null) => {
      if (selectedRef.current) {
        const prevMat = selectedRef.current.material as THREE.MeshStandardMaterial;
        prevMat.emissive.setHex(0x000000);
      }
      if (mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(0x2a2a2a);
      }
      selectedRef.current = mesh;
    };

    const handleTap = (x: number, y: number) => {
      const camera = cameraRef.current;
      if (!camera) return;
      const { width, height } = sizeRef.current;
      const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(atomMeshesRef.current);
      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh;
        highlight(mesh);
        onAtomTap(mesh.userData.atom as AtomTapInfo);
      } else {
        highlight(null);
        onAtomTap(null);
      }
    };

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

    const tap = Gesture.Tap().onEnd((e, success) => {
      if (success) handleTap(e.x, e.y);
    });

    const composed = Gesture.Simultaneous(panOneFinger, panTwoFinger, pinch, tap);

    const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      sizeRef.current = { width, height };

      const renderer = new Renderer({ gl, width, height, clearColor: colors.bg });
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

      const center = new THREE.Vector3();
      for (const atom of ligand.atoms) center.add(new THREE.Vector3(atom.x, atom.y, atom.z));
      if (ligand.atoms.length > 0) center.divideScalar(ligand.atoms.length);

      let maxDist = 1;
      const positions = new Map<number, THREE.Vector3>();
      for (const atom of ligand.atoms) {
        const p = new THREE.Vector3(atom.x, atom.y, atom.z).sub(center);
        positions.set(atom.id, p);
        maxDist = Math.max(maxDist, p.length());
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
        const mesh = new THREE.Mesh(sphereGeom, materialFor(el.cpkHex));
        const p = positions.get(atom.id)!;
        mesh.position.copy(p);
        mesh.scale.setScalar(el.radius * SPHERE_SCALE);
        mesh.userData.atom = { element: el.symbol, name: atom.name, x: atom.x, y: atom.y, z: atom.z };
        group.add(mesh);
        atomMeshes.push(mesh);
      }
      atomMeshesRef.current = atomMeshes;

      for (const bond of ligand.bonds) {
        const pa = positions.get(bond.a);
        const pb = positions.get(bond.b);
        if (!pa || !pb) continue;
        const dir = new THREE.Vector3().subVectors(pb, pa);
        const length = dir.length();
        if (length < 1e-6) continue;
        const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
        const atomA = ligand.atoms.find((a) => a.id === bond.a);
        const atomB = ligand.atoms.find((a) => a.id === bond.b);
        const colorA = elementFor(atomA?.element ?? '').cpkHex;
        const colorB = elementFor(atomB?.element ?? '').cpkHex;
        const half = length / 2;
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

        const meshA = new THREE.Mesh(cylinderGeom, materialFor(colorA));
        meshA.scale.set(BOND_RADIUS, half, BOND_RADIUS);
        meshA.quaternion.copy(quat);
        meshA.position.copy(pa).addScaledVector(dir, 0.25);
        group.add(meshA);

        const meshB = new THREE.Mesh(cylinderGeom, materialFor(colorB));
        meshB.scale.set(BOND_RADIUS, half, BOND_RADIUS);
        meshB.quaternion.copy(quat);
        meshB.position.copy(mid).addScaledVector(dir, 0.25);
        group.add(meshB);
      }

      const renderLoop = () => {
        group.rotation.x = rotation.current.x;
        group.rotation.y = rotation.current.y;
        applyCamera();
        renderer.render(scene, camera);
        gl.endFrameEXP();
        rafRef.current = requestAnimationFrame(renderLoop);
      };
      renderLoop();

      disposeRef.current = () => {
        sphereGeom.dispose();
        cylinderGeom.dispose();
        materialCache.forEach((mat) => mat.dispose());
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
        </View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
});
