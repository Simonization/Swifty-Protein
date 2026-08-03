import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoleculeBackdrop } from '../components/MoleculeBackdrop';
import { SearchBar } from '../components/SearchBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { colors, radii, spacing, typography } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import { LIGAND_IDS } from '../data/ligandIds';
import { listCachedLigands, loadLigand, type CachedLigand } from '../data/ligands';
import { readFavorites, writeFavorites } from '../data/favorites';
import { RcsbError, type RcsbErrorKind } from '../lib/rcsb';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandList'>;

type Filter = 'all' | 'favorites';

const ERROR_TITLES: Record<RcsbErrorKind, string> = {
  not_found: 'Ligand not found',
  offline: 'No connection',
  timeout: 'Request timed out',
  parse: 'Couldn’t read ligand',
  too_large: 'File too large',
};

export function LigandListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [cached, setCached] = useState<Map<string, CachedLigand>>(new Map());

  // On focus, not just on mount: opening a ligand caches it, so coming back
  // should show it as offline-ready without a relaunch.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const [favoriteIds, cachedLigands] = await Promise.all([readFavorites(), listCachedLigands()]);
          if (!active) return;
          setFavorites(new Set(favoriteIds));
          setCached(cachedLigands);
        } catch {
          // Both are decoration on a list that works without them, so a broken
          // read leaves the plain list rather than taking the screen down.
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const base = filter === 'favorites' ? LIGAND_IDS.filter((id) => favorites.has(id)) : LIGAND_IDS;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    // Ids always match (VI.3 mandates that); names only exist for ligands that
    // have been opened once, so name matching is a bonus on top, never the
    // only way to find something.
    return base.filter(
      (id) => id.toLowerCase().includes(q) || cached.get(id)?.name?.toLowerCase().includes(q)
    );
  }, [query, filter, favorites, cached]);

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
    // Best-effort, like the ligand cache: a failed write costs this favourite
    // on the next launch and nothing else, so it must not interrupt the tap.
    void writeFavorites([...next]).catch(() => {});
  };

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
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => logout()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <MaterialCommunityIcons name="logout" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} />
        <View style={styles.filterRow}>
          <FilterChip
            label={`All ${LIGAND_IDS.length}`}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterChip
            label={`Favorites ${favorites.size}`}
            icon="star"
            active={filter === 'favorites'}
            onPress={() => setFilter('favorites')}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(id) => id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={24}
        windowSize={10}
        renderItem={({ item }) => (
          <LigandRow
            id={item}
            info={cached.get(item)}
            favorite={favorites.has(item)}
            onPress={() => handleSelect(item)}
            onToggleFavorite={() => toggleFavorite(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'favorites' && !query.trim()
                ? 'No favorites yet — tap the star on any ligand.'
                : `No ligands match “${query}”.`}
            </Text>
          </View>
        }
      />

      <LoadingOverlay visible={!!pendingId} label={`Fetching ${pendingId}…`} />
    </SafeAreaView>
  );
}

// A cached ligand knows its own name and formula, so its row can show what an
// id alone cannot — and say out loud that it opens with no connection (VII.2's
// custom cells, and the only visible sign that VII.4's cache exists).
function LigandRow({
  id,
  info,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  id: string;
  info?: CachedLigand;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const subtitle = info ? [info.name, info.formula].filter(Boolean).join(' · ') : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[id, subtitle, info && 'available offline'].filter(Boolean).join(', ')}
      accessibilityHint="Opens the 3D viewer"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon} importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name="atom" size={18} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{id}</Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {info ? (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <MaterialCommunityIcons name="cloud-check-outline" size={11} color={colors.success} />
          <Text style={styles.badgeText}>Offline</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onToggleFavorite}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${id} from favorites` : `Add ${id} to favorites`}
        accessibilityState={{ selected: favorite }}
        style={styles.star}
      >
        <MaterialCommunityIcons
          name={favorite ? 'star' : 'star-outline'}
          size={20}
          color={favorite ? colors.primary : colors.textFaint}
        />
      </Pressable>
    </Pressable>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={12}
          color={active ? colors.bg : colors.textMuted}
          importantForAccessibility="no"
        />
      ) : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
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
  filterRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  chip: {
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
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
  rowText: { flex: 1 },
  rowLabel: { ...typography.title, fontSize: 16, color: colors.text, letterSpacing: 1 },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  badgeText: { ...typography.caption, fontSize: 10, color: colors.success },
  star: { padding: spacing(1) },
  empty: { paddingTop: spacing(12), alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
