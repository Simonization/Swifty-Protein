import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoleculeBackdrop } from '../components/MoleculeBackdrop';
import { SearchBar } from '../components/SearchBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { colors, radii, spacing, typography } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import { LIGAND_IDS } from '../data/ligandIds';
import { loadLigand } from '../data/ligands';
import { RcsbError, type RcsbErrorKind } from '../lib/rcsb';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandList'>;

const ERROR_TITLES: Record<RcsbErrorKind, string> = {
  not_found: 'Ligand not found',
  offline: 'No connection',
  timeout: 'Request timed out',
  parse: 'Couldn’t read ligand',
};

export function LigandListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LIGAND_IDS;
    return LIGAND_IDS.filter((id) => id.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = async (id: string) => {
    if (pendingId) return; // one fetch at a time
    setPendingId(id);
    try {
      const ligand = await loadLigand(id);
      navigation.navigate('LigandView', { ligand });
    } catch (err) {
      if (err instanceof RcsbError) {
        Alert.alert(ERROR_TITLES[err.kind], err.message);
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.fill}>
      <MoleculeBackdrop />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ligands</Text>
          <Text style={styles.subtitle}>{LIGAND_IDS.length} entries · RCSB PDB</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => logout()} hitSlop={8}>
            <MaterialCommunityIcons name="logout" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(id) => id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={24}
        windowSize={10}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="atom" size={18} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{item}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No ligands match “{query}”.</Text>
          </View>
        }
      />

      <LoadingOverlay visible={!!pendingId} label={`Fetching ${pendingId}…`} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(6),
    paddingTop: spacing(4),
    paddingBottom: spacing(3),
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
  searchWrap: { paddingHorizontal: spacing(6), marginBottom: spacing(3) },
  listContent: { paddingHorizontal: spacing(6), paddingBottom: spacing(10) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
    marginBottom: spacing(2.5),
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.title, fontSize: 16, color: colors.text, flex: 1, letterSpacing: 1 },
  empty: { paddingTop: spacing(12), alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
});
