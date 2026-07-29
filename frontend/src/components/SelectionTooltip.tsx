// The overlay for whatever the viewer has selected (VII.3).
//
// Atom, bond and measurement are three shapes of one selection and can never be
// on screen together, so they share one box in one position rather than three
// stacked absolutely on top of each other.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { Selection } from './MoleculeViewer';

const BOND_ORDER_LABEL: Record<1 | 2 | 3, string> = { 1: 'Single', 2: 'Double', 3: 'Triple' };

export function SelectionTooltip({ selection }: { selection: Selection }) {
  if (selection.kind === 'atom') {
    const { atom } = selection;
    // The element table carries the full name and atomic number for all 118
    // elements; a symbol alone is what a debug readout shows.
    const el = elementFor(atom.element);
    return (
      <Tooltip dotColor={`#${el.cpkHex}`}>
        <Text style={styles.heading}>
          {el.name} · {atom.element}
        </Text>
        <Text style={styles.detail}>
          {[el.number > 0 ? `Z ${el.number}` : null, `atom ${atom.name}`].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.detail}>
          {atom.x.toFixed(2)}, {atom.y.toFixed(2)}, {atom.z.toFixed(2)} Å
        </Text>
        <Text style={styles.detail}>Same-element atoms highlighted</Text>
      </Tooltip>
    );
  }

  if (selection.kind === 'bond') {
    const { bond } = selection;
    return (
      <Tooltip>
        <Text style={styles.heading}>
          {BOND_ORDER_LABEL[bond.order]} bond{bond.aromatic ? ' (aromatic)' : ''}
        </Text>
        <Text style={styles.detail}>
          {bond.a.element}–{bond.b.element} · {bond.length.toFixed(2)} Å
        </Text>
      </Tooltip>
    );
  }

  const { measurement } = selection;
  const pending = measurement.distance == null && measurement.angleDeg == null;
  return (
    <Tooltip>
      <Text style={styles.heading}>{measurement.points.map((p) => p.element).join(' – ')}</Text>
      {measurement.distance != null && (
        <Text style={styles.detail}>Distance: {measurement.distance.toFixed(2)} Å</Text>
      )}
      {measurement.angleDeg != null && (
        <Text style={styles.detail}>Angle: {measurement.angleDeg.toFixed(1)}°</Text>
      )}
      {pending && <Text style={styles.detail}>Tap another atom…</Text>}
    </Tooltip>
  );
}

function Tooltip({ dotColor, children }: { dotColor?: string; children: ReactNode }) {
  return (
    <View style={styles.tooltip} pointerEvents="none">
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: spacing(3),
    left: spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: 'rgba(20, 27, 46, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  heading: { ...typography.label, color: colors.text },
  detail: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
});
