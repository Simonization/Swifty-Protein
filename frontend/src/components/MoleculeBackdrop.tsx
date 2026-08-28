import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

// Faint "atoms + bonds" constellation, purely decorative, behind screen content.
// Reuses a handful of theme hues so it visually rhymes with the 3D viewer to
// come, and stays legible in both palettes rather than hardcoding hex values
// (a literal white dot would be invisible on the light background).
type NodeRole = 'primary' | 'accent' | 'bright' | 'warn';

const NODES: { x: number; y: number; size: number; role: NodeRole }[] = [
  { x: 0.08, y: 0.1, size: 10, role: 'primary' },
  { x: 0.22, y: 0.22, size: 6, role: 'bright' },
  { x: 0.85, y: 0.14, size: 8, role: 'accent' },
  { x: 0.92, y: 0.32, size: 5, role: 'warn' },
  { x: 0.1, y: 0.82, size: 7, role: 'accent' },
  { x: 0.28, y: 0.92, size: 5, role: 'primary' },
  { x: 0.88, y: 0.86, size: 9, role: 'bright' },
];

const BONDS: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 0.08, y1: 0.1, x2: 0.22, y2: 0.22 },
  { x1: 0.85, y1: 0.14, x2: 0.92, y2: 0.32 },
  { x1: 0.1, y1: 0.82, x2: 0.28, y2: 0.92 },
];

function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function angleDeg(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function MoleculeBackdrop() {
  const { colors, gradients } = useTheme();
  const roleColor: Record<NodeRole, string> = {
    primary: colors.primary,
    accent: colors.accent,
    bright: colors.text,
    warn: colors.danger,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />
      {BONDS.map((b, i) => {
        const dx = b.x2 - b.x1;
        const dy = b.y2 - b.y1;
        return (
          <View
            key={`bond-${i}`}
            style={{
              position: 'absolute',
              left: `${b.x1 * 100}%`,
              top: `${b.y1 * 100}%`,
              width: `${distance(dx, dy) * 100}%`,
              height: 1.5,
              backgroundColor: colors.border,
              opacity: 0.6,
              transform: [{ rotate: `${angleDeg(dx, dy)}deg` }],
            }}
          />
        );
      })}
      {NODES.map((n, i) => (
        <View
          key={`node-${i}`}
          style={{
            position: 'absolute',
            left: `${n.x * 100}%`,
            top: `${n.y * 100}%`,
            width: n.size,
            height: n.size,
            borderRadius: n.size,
            backgroundColor: roleColor[n.role],
            opacity: 0.35,
          }}
        />
      ))}
    </View>
  );
}
