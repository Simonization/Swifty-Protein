import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { MoleculeViewer, type AtomTapInfo, type MoleculeViewerHandle } from '../components/MoleculeViewer';
import { colors, radii, spacing, typography } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandView'>;

export function LigandViewScreen({ route, navigation }: Props) {
  const { ligand } = route.params;
  const viewerRef = useRef<MoleculeViewerHandle>(null);
  const [selectedAtom, setSelectedAtom] = useState<AtomTapInfo | null>(null);
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
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${ligand.id} — Swifty Protein` });
    } catch {
      Alert.alert('Something went wrong', 'Please try sharing again.');
    } finally {
      setSharing(false);
    }
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

      <View style={styles.viewerWrap}>
        <MoleculeViewer ref={viewerRef} ligand={ligand} onAtomTap={setSelectedAtom} />

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
            </View>
          </View>
        )}

        <Text style={styles.hint} pointerEvents="none">
          Drag to rotate · pinch to zoom · two fingers to pan · tap an atom
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
