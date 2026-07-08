import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../theme/theme';
import { elementFor } from '../data/elements';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandView'>;

// Stub landing after a successful fetch+parse — the 3D ball-and-stick viewer
// (VI.4) replaces this body next; this confirms the pipeline end-to-end.
export function LigandViewScreen({ route, navigation }: Props) {
  const { ligand } = route.params;

  const elementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const atom of ligand.atoms) counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [ligand.atoms]);

  return (
    <Screen>
      <View style={styles.iconBadge}>
        <MaterialCommunityIcons name="molecule" size={36} color={colors.primary} />
      </View>
      <Text style={styles.id}>{ligand.id}</Text>
      {ligand.name && <Text style={styles.name}>{ligand.name}</Text>}
      {ligand.formula && <Text style={styles.formula}>{ligand.formula}</Text>}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ligand.atoms.length}</Text>
          <Text style={styles.statLabel}>Atoms</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ligand.bonds.length}</Text>
          <Text style={styles.statLabel}>Bonds</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {elementCounts.map(([symbol, count]) => (
          <View key={symbol} style={styles.legendChip}>
            <View style={[styles.dot, { backgroundColor: `#${elementFor(symbol).cpkHex}` }]} />
            <Text style={styles.legendText}>
              {symbol} × {count}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>The 3D ball-and-stick viewer lands here next.</Text>
      <View style={styles.gap} />
      <Button label="Back to list" variant="ghost" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing(5),
  },
  id: { ...typography.display, color: colors.text, textAlign: 'center', letterSpacing: 2 },
  name: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing(1) },
  formula: { ...typography.caption, color: colors.textFaint, textAlign: 'center', marginTop: spacing(1) },
  statsRow: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(6), justifyContent: 'center' },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(4),
    paddingHorizontal: spacing(7),
    alignItems: 'center',
  },
  statValue: { ...typography.title, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), justifyContent: 'center', marginTop: spacing(6) },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.text },
  note: { ...typography.caption, color: colors.textFaint, textAlign: 'center', marginTop: spacing(8) },
  gap: { height: spacing(4) },
});
