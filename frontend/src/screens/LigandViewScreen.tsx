import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import {
  MoleculeViewer,
  type AtomTapInfo,
  type BondTapInfo,
  type MeasurementInfo,
  type MoleculeViewerHandle,
  type ViewMode,
} from '../components/MoleculeViewer';
import { colors, radii, spacing, typography } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { AppStackParamList } from '../navigation/types';
import type { Ligand } from '../types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandView'>;

const MODES: { key: ViewMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'ballStick', label: 'Ball & Stick', icon: 'chart-bubble' },
  { key: 'spaceFilling', label: 'Space-Filling', icon: 'circle' },
  { key: 'stick', label: 'Stick', icon: 'grid' },
  { key: 'wireframe', label: 'Wireframe', icon: 'vector-line' },
];

const BOND_ORDER_LABEL: Record<1 | 2 | 3, string> = { 1: 'Single', 2: 'Double', 3: 'Triple' };

// Bonus VII.5: describe what is actually in the picture, not just its id.
// e.g. "ATP — ADENOSINE-5'-TRIPHOSPHATE · C10 H16 N5 O13 P3 · 47 atoms"
function describeLigand(ligand: Ligand): string {
  const headline = [ligand.id, ligand.name].filter(Boolean).join(' — ');
  const details = [ligand.formula, `${ligand.atoms.length} atoms`].filter(Boolean);
  return [headline, ...details].join(' · ');
}

export function LigandViewScreen({ route, navigation }: Props) {
  const { ligand } = route.params;
  const viewerRef = useRef<MoleculeViewerHandle>(null);
  const [selectedAtom, setSelectedAtom] = useState<AtomTapInfo | null>(null);
  const [selectedBond, setSelectedBond] = useState<BondTapInfo | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementInfo | null>(null);
  const [mode, setMode] = useState<ViewMode>('ballStick');
  const [showLabels, setShowLabels] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await viewerRef.current?.captureSnapshot();
      if (!uri) {
        Alert.alert('Couldn’t capture', 'Try again once the model has finished loading.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: describeLigand(ligand) });
    } catch {
      Alert.alert('Something went wrong', 'Please try sharing again.');
    } finally {
      setSharing(false);
    }
  };

  const toggleMeasureMode = () => {
    // The viewer clears its own measurement when measureMode goes false, so this
    // must not also do it from inside the updater — React may run that twice.
    setMeasureMode((prev) => !prev);
    setSelectedAtom(null);
    setSelectedBond(null);
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.id}>{ligand.id}</Text>
          {ligand.name && (
            <Text style={styles.name} numberOfLines={1}>
              {ligand.name}
            </Text>
          )}
        </View>
        <Pressable onPress={handleShare} hitSlop={8} style={styles.iconButton} disabled={sharing}>
          <MaterialCommunityIcons
            name={sharing ? 'timer-sand' : 'share-variant'}
            size={22}
            color={colors.primary}
          />
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={[styles.modeButton, mode === m.key && styles.modeButtonActive]}
          >
            <MaterialCommunityIcons
              name={m.icon}
              size={16}
              color={mode === m.key ? colors.bg : colors.textMuted}
            />
            <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolRow}>
        <Pressable onPress={() => setShowLabels((v) => !v)} style={[styles.toolButton, showLabels && styles.toolButtonActive]}>
          <MaterialCommunityIcons name="tag-text-outline" size={16} color={showLabels ? colors.bg : colors.textMuted} />
          <Text style={[styles.toolLabel, showLabels && styles.toolLabelActive]}>Labels</Text>
        </Pressable>
        <Pressable onPress={toggleMeasureMode} style={[styles.toolButton, measureMode && styles.toolButtonActive]}>
          <MaterialCommunityIcons name="ruler" size={16} color={measureMode ? colors.bg : colors.textMuted} />
          <Text style={[styles.toolLabel, measureMode && styles.toolLabelActive]}>Measure</Text>
        </Pressable>
      </View>

      <View style={styles.viewerWrap}>
        <MoleculeViewer
          ref={viewerRef}
          ligand={ligand}
          mode={mode}
          showLabels={showLabels}
          measureMode={measureMode}
          onAtomTap={(atom) => {
            setSelectedAtom(atom);
            if (atom) setSelectedBond(null);
          }}
          onBondTap={(bond) => {
            setSelectedBond(bond);
            if (bond) setSelectedAtom(null);
          }}
          onMeasurementChange={setMeasurement}
        />

        {selectedAtom && (
          <View style={styles.tooltip} pointerEvents="none">
            <View style={[styles.tooltipDot, { backgroundColor: `#${elementFor(selectedAtom.element).cpkHex}` }]} />
            <View>
              <Text style={styles.tooltipSymbol}>
                {selectedAtom.element} · {selectedAtom.name}
              </Text>
              <Text style={styles.tooltipCoords}>
                {selectedAtom.x.toFixed(2)}, {selectedAtom.y.toFixed(2)}, {selectedAtom.z.toFixed(2)}
              </Text>
              <Text style={styles.tooltipCoords}>Same-element atoms highlighted</Text>
            </View>
          </View>
        )}

        {selectedBond && (
          <View style={styles.tooltip} pointerEvents="none">
            <View>
              <Text style={styles.tooltipSymbol}>
                {BOND_ORDER_LABEL[selectedBond.order]} bond{selectedBond.aromatic ? ' (aromatic)' : ''}
              </Text>
              <Text style={styles.tooltipCoords}>
                {selectedBond.a.element}–{selectedBond.b.element} · {selectedBond.length.toFixed(2)} Å
              </Text>
            </View>
          </View>
        )}

        {measureMode && measurement && (
          <View style={styles.tooltip} pointerEvents="none">
            <View>
              <Text style={styles.tooltipSymbol}>
                {measurement.points.map((p) => p.element).join(' – ')}
              </Text>
              {measurement.distance != null && (
                <Text style={styles.tooltipCoords}>Distance: {measurement.distance.toFixed(2)} Å</Text>
              )}
              {measurement.angleDeg != null && (
                <Text style={styles.tooltipCoords}>Angle: {measurement.angleDeg.toFixed(1)}°</Text>
              )}
              {measurement.distance == null && measurement.angleDeg == null && (
                <Text style={styles.tooltipCoords}>Tap another atom…</Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.hint} pointerEvents="none">
          {measureMode
            ? 'Tap 2 atoms for distance, 3 for angle'
            : 'Drag to rotate · pinch to zoom · double-tap an atom to center'}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ligand.atoms.length}</Text>
          <Text style={styles.statLabel}>Atoms</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ligand.bonds.length}</Text>
          <Text style={styles.statLabel}>Bonds</Text>
        </View>
        {ligand.formula && (
          <View style={styles.statCard}>
            <Text style={styles.statValue} numberOfLines={1}>
              {ligand.formula}
            </Text>
            <Text style={styles.statLabel}>Formula</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, alignItems: 'center' },
  id: { ...typography.title, color: colors.text, letterSpacing: 1.5 },
  name: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  modeRow: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    marginBottom: spacing(2),
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    paddingVertical: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  modeLabelActive: { color: colors.bg, fontWeight: '700' },
  toolRow: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    marginBottom: spacing(2),
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toolLabel: { ...typography.caption, color: colors.textMuted },
  toolLabelActive: { color: colors.bg, fontWeight: '700' },
  viewerWrap: { flex: 1, marginHorizontal: spacing(4), borderRadius: radii.lg, overflow: 'hidden', position: 'relative' },
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
  tooltipDot: { width: 14, height: 14, borderRadius: 7 },
  tooltipSymbol: { ...typography.label, color: colors.text },
  tooltipCoords: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  hint: {
    position: 'absolute',
    bottom: spacing(3),
    alignSelf: 'center',
    ...typography.caption,
    color: colors.textFaint,
    backgroundColor: 'rgba(10, 14, 23, 0.6)',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.pill,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(4),
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  statValue: { ...typography.title, fontSize: 16, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
});
