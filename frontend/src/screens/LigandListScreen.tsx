import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoleculeBackdrop } from '../components/MoleculeBackdrop';
import { SearchBar } from '../components/SearchBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { colors, radii, spacing, typography } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import { useOrientation } from '../hooks/useOrientation';
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
  // A 5xx is not the same failure as a dead network, and titling it "No
  // connection" over a body that says "RCSB returned 503" reads as a bug.
  server: 'RCSB unavailable',
  timeout: 'Request timed out',
  parse: 'Couldn’t read ligand',
  too_large: 'File too large',
};

// Rows are a fixed height so FlatList can lay them out without measuring.
// Kept next to the style that enforces it — the two must not drift.
const ROW_HEIGHT = 64;
const ROW_GAP = spacing(2.5);
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;

const keyExtractor = (id: string) => id;

// Tablets and landscape phones get two columns rather than one long stretched
// row — the same width-awareness LigandViewScreen already has via useOrientation.
// getItemLayout has to account for numColumns: every `numColumns` items share a
// row, so the offset is keyed off the row index, not the item index.
const getItemLayoutFor = (numColumns: number) => (_: ArrayLike<string> | null | undefined, index: number) => ({
  length: ROW_STRIDE,
  offset: ROW_STRIDE * Math.floor(index / numColumns),
  index,
});

export function LigandListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { isWide } = useOrientation();
  const numColumns = isWide ? 2 : 1;
  const getItemLayout = useMemo(() => getItemLayoutFor(numColumns), [numColumns]);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  // 0..1 while a large ligand is mid-parse (VII.4's progress indication);
  // stays null for the common case where parsing finishes before it matters.
  const [parseProgress, setParseProgress] = useState<number | null>(null);
  // The re-entrancy guard has to be a ref: handleSelect is memoised so that rows
  // can be, and reading `pendingId` from its closure would be a render behind.
  const pendingRef = useRef<string | null>(null);
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

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Best-effort, like the ligand cache: a failed write costs this favourite
      // on the next launch and nothing else, so it must not interrupt the tap.
      void writeFavorites([...next]).catch(() => {});
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    async (id: string) => {
      if (pendingRef.current) return; // one fetch at a time
      pendingRef.current = id;
      setPendingId(id);
      setParseProgress(null);
      try {
        const ligand = await loadLigand(id, (fraction) => setParseProgress(fraction));
        navigation.navigate('LigandView', { ligand });
      } catch (err) {
        const [title, message] =
          err instanceof RcsbError
            ? [ERROR_TITLES[err.kind], err.message]
            : ['Something went wrong', 'Please try again.'];
        // Order matters, and only on iOS. `Alert` is presented on the topmost
        // view controller, which while the loading Modal is up is the Modal —
        // so dismissing the Modal a moment later takes the alert down with it
        // and the user never sees why the ligand failed. Drop the overlay
        // first, then alert once the dismissal animation has run.
        pendingRef.current = null;
        setPendingId(null);
        setParseProgress(null);
        InteractionManager.runAfterInteractions(() => Alert.alert(title, message));
        return;
      }
      pendingRef.current = null;
      setPendingId(null);
      setParseProgress(null);
    },
    [navigation],
  );

  // Stable identity, so React.memo on the row actually holds: without this a
  // fresh arrow per render would re-render every visible row on every keystroke.
  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <LigandRow
        id={item}
        info={cached.get(item)}
        favorite={favorites.has(item)}
        onPress={handleSelect}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [cached, favorites, handleSelect, toggleFavorite],
  );

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
        // FlatList cannot change numColumns on a live instance — remount via
        // key when the device rotates or the width crosses the tablet breakpoint.
        key={`cols-${numColumns}`}
        data={filtered}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={24}
        windowSize={10}
        removeClippedSubviews
        // Every row is exactly ROW_HEIGHT tall, so FlatList can place them
        // without measuring — that's what keeps scrolling and per-keystroke
        // filtering smooth across 1,243 entries.
        getItemLayout={getItemLayout}
        renderItem={renderItem}
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

      <LoadingOverlay
        visible={!!pendingId}
        label={
          parseProgress !== null && parseProgress < 1
            ? `Parsing ${pendingId}… ${Math.round(parseProgress * 100)}%`
            : `Fetching ${pendingId}…`
        }
      />
    </SafeAreaView>
  );
}

// A cached ligand knows its own name and formula, so its row can show what an
// id alone cannot — and say out loud that it opens with no connection (VII.2's
// custom cells, and the only visible sign that VII.4's cache exists).
const LigandRow = memo(function LigandRow({
  id,
  info,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  id: string;
  info?: CachedLigand;
  favorite: boolean;
  // Take the id rather than closing over it, so the parent can hand every row
  // the same two memoised functions.
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const subtitle = info ? [info.name, info.formula].filter(Boolean).join(' · ') : null;
  const starScale = useRef(new Animated.Value(1)).current;
  const bounceStar = useCallback(() => {
    starScale.setValue(1);
    Animated.sequence([
      Animated.timing(starScale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(starScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onToggleFavorite(id);
  }, [id, onToggleFavorite, starScale]);
  return (
    <Pressable
      onPress={() => onPress(id)}
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
        onPress={bounceStar}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${id} from favorites` : `Add ${id} to favorites`}
        accessibilityState={{ selected: favorite }}
        style={styles.star}
      >
        <Animated.View style={{ transform: [{ scale: starScale }] }}>
          <MaterialCommunityIcons
            name={favorite ? 'star' : 'star-outline'}
            size={20}
            color={favorite ? colors.primary : colors.textFaint}
          />
        </Animated.View>
      </Pressable>
    </Pressable>
  );
});

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
  // Only applied when numColumns > 1 (see the FlatList prop above) — RN warns
  // if columnWrapperStyle is set while numColumns is 1.
  columnWrapper: { gap: spacing(3) },
  row: {
    // flex: 1 matters once there is more than one column: without it, a
    // multi-item row sizes each item to its content instead of splitting the
    // row evenly. Harmless in the single-column case, where it already fills
    // the available width.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    // Fixed, not padding-derived: getItemLayout above promises FlatList this
    // exact height, and a cached row (which has a subtitle) would otherwise be
    // taller than an uncached one.
    height: ROW_HEIGHT,
    paddingHorizontal: spacing(4),
    marginBottom: ROW_GAP,
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
