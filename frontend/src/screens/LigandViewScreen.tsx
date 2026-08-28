import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import {
  MoleculeViewer,
  type MoleculeViewerHandle,
  type Selection,
  type ViewMode,
} from '../components/MoleculeViewer';
import { SelectionTooltip } from '../components/SelectionTooltip';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { radii, spacing, typography, type ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { VIEW_MODES } from '../data/viewModes';
import {
  photoLibraryAvailable,
  requestPhotoPermission,
  saveImageToPhotos,
} from '../lib/photoLibrary';
import { useSettings } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { useOrientation } from '../hooks/useOrientation';
import type { AppStackParamList } from '../navigation/types';
import type { Ligand } from '../types';

type Props = NativeStackScreenProps<AppStackParamList, 'LigandView'>;

// Each tap on +/- changes the zoom by this much.
const ZOOM_STEP = 1.35;

// Bonus VII.5: describe what is actually in the picture, not just its id.
// e.g. "ATP — ADENOSINE-5'-TRIPHOSPHATE · C10 H16 N5 O13 P3 · 47 atoms"
function describeLigand(ligand: Ligand): string {
  const headline = [ligand.id, ligand.name].filter(Boolean).join(' — ');
  const details = [ligand.formula, `${ligand.atoms.length} atoms`].filter(Boolean);
  return [headline, ...details].join(' · ');
}

export function LigandViewScreen({ route, navigation }: Props) {
  const { ligand } = route.params;
  const { settings } = useSettings();
  const { runWithoutRelock } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isLandscape } = useOrientation();
  const viewerRef = useRef<MoleculeViewerHandle>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  // Seeded from Settings (VII.2); both stay switchable per ligand from here.
  const [mode, setMode] = useState<ViewMode>(settings.defaultMode);
  const [showLabels, setShowLabels] = useState(settings.showLabelsByDefault);
  const [measureMode, setMeasureMode] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  // Wireframe draws bonds only and Stick shrinks atoms to almost nothing, so a
  // ligand with no bonds at all (the single-atom ions — ZN, CU, FE) renders an
  // empty box in one and a speck in the other. Say so rather than looking broken.
  const noBonds = ligand.bonds.length === 0;
  const emptyForMode = noBonds && (mode === 'wireframe' || mode === 'stick');

  const snapshot = async (): Promise<string | null> => {
    const uri = await viewerRef.current?.captureSnapshot();
    if (!uri) {
      Alert.alert('Couldn’t capture', 'Try again once the model has finished loading.');
      return null;
    }
    return uri;
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy('share');
    try {
      const uri = await snapshot();
      if (!uri) return;
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing is not supported on this device.');
        return;
      }
      // The chooser is a separate activity on Android, so without this the app
      // would re-lock and the user would come back from the share sheet on the
      // Login screen instead of on their molecule.
      await runWithoutRelock(() =>
        Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: describeLigand(ligand) }),
      );
    } catch {
      Alert.alert('Something went wrong', 'Please try sharing again.');
    } finally {
      setBusy(null);
    }
  };

  // The evaluation sheet describes sharing as "for example you can save it in
  // your Photos", and the system chooser does not reliably offer the gallery on
  // Android — so this is its own action rather than a share target.
  const handleSaveToPhotos = async () => {
    if (busy) return;
    setBusy('save');
    try {
      const granted = await requestPhotoPermission();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Swifty Protein needs access to your photo library to save the image.',
        );
        return;
      }
      const uri = await snapshot();
      if (!uri) return;
      await saveImageToPhotos(uri);
      Alert.alert('Saved to Photos', `${describeLigand(ligand)}\n\nThe image is in your gallery.`);
    } catch {
      Alert.alert('Couldn’t save', 'The image could not be saved to your photo library.');
    } finally {
      setBusy(null);
    }
  };

  const toggleMeasureMode = () => {
    // Leaving measure mode, the viewer clears its own measurement and reports
    // it — so this only has to drop an atom/bond selection on the way in.
    setMeasureMode((prev) => !prev);
    setSelection(null);
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to the ligand list"
          style={styles.iconButton}
        >
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
        <View style={styles.headerActions}>
          {/* Hidden on web, where there is no gallery to save into. */}
          {photoLibraryAvailable && (
          <Pressable
            onPress={handleSaveToPhotos}
            hitSlop={8}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={
              busy === 'save' ? 'Saving image to Photos' : `Save an image of ${ligand.id} to Photos`
            }
            accessibilityState={{ disabled: busy !== null, busy: busy === 'save' }}
            style={styles.iconButton}
          >
            <MaterialCommunityIcons
              name={busy === 'save' ? 'timer-sand' : 'download'}
              size={22}
              color={colors.primary}
            />
          </Pressable>
          )}
          <Pressable
            onPress={handleShare}
            hitSlop={8}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={
              busy === 'share' ? 'Preparing image to share' : `Share an image of ${ligand.id}`
            }
            accessibilityState={{ disabled: busy !== null, busy: busy === 'share' }}
            style={styles.iconButton}
          >
            <MaterialCommunityIcons
              name={busy === 'share' ? 'timer-sand' : 'share-variant'}
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {/* Portrait stacks the two control rows; landscape puts them side by side,
          because height is the scarce axis there and the viewer needs it. */}
      <View style={isLandscape ? styles.controlsLandscape : undefined}>
      <View style={[styles.modeRow, isLandscape && styles.modeRowLandscape]}>
        {VIEW_MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} view`}
            accessibilityState={{ selected: mode === m.key }}
            style={[styles.modeButton, mode === m.key && styles.modeButtonActive]}
          >
            <MaterialCommunityIcons
              name={m.icon}
              size={16}
              color={mode === m.key ? colors.bg : colors.textMuted}
              importantForAccessibility="no"
            />
            <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.toolRow, isLandscape && styles.toolRowLandscape]}>
        <Pressable
          onPress={() => setShowLabels((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Atom labels"
          accessibilityHint="Shows or hides the element label on every atom"
          accessibilityState={{ selected: showLabels }}
          style={[styles.toolButton, showLabels && styles.toolButtonActive]}
        >
          <MaterialCommunityIcons
            name="tag-text-outline"
            size={16}
            color={showLabels ? colors.bg : colors.textMuted}
            importantForAccessibility="no"
          />
          <Text style={[styles.toolLabel, showLabels && styles.toolLabelActive]}>Labels</Text>
        </Pressable>
        <Pressable
          onPress={toggleMeasureMode}
          accessibilityRole="button"
          accessibilityLabel="Measure mode"
          accessibilityHint="Tap two atoms for a distance, three for an angle"
          accessibilityState={{ selected: measureMode }}
          style={[styles.toolButton, measureMode && styles.toolButtonActive]}
        >
          <MaterialCommunityIcons
            name="ruler"
            size={16}
            color={measureMode ? colors.bg : colors.textMuted}
            importantForAccessibility="no"
          />
          <Text style={[styles.toolLabel, measureMode && styles.toolLabelActive]}>Measure</Text>
        </Pressable>
      </View>
      </View>

      <View style={styles.viewerWrap}>
        {/* Its own boundary: a three.js failure takes out the canvas but leaves
            the header, the back button and the share actions working. */}
        <ErrorBoundary resetKey={`${ligand.id}:${mode}`}>
          <MoleculeViewer
            ref={viewerRef}
            ligand={ligand}
            mode={mode}
            showLabels={showLabels}
            measureMode={measureMode}
            onSelectionChange={setSelection}
            onTooLarge={(info) =>
              Alert.alert(
                'Molecule too large to display',
                `This ligand has ${info.atoms} atoms and ${info.bonds} bonds, past the ${info.maxAtoms}/${info.maxBonds} limit this viewer can render.`
              )
            }
            onAutoDegrade={() => {
              // The viewer already turned labels off internally (bonus VII.4's
              // 60 FPS guard) — this just keeps the Labels toggle button honest
              // about it, and says why, once, rather than leaving the button lit
              // while nothing it promises is actually on screen any more.
              setShowLabels(false);
              Alert.alert(
                'Labels turned off',
                'Atom labels were disabled automatically to keep the view smooth on this device. You can turn them back on from the Labels button.',
              );
            }}
          />
        </ErrorBoundary>

        {selection && <SelectionTooltip selection={selection} />}

        {emptyForMode && (
          <View style={styles.emptyMode} pointerEvents="none">
            <Text style={styles.emptyModeText}>
              {ligand.id} is a single atom with no bonds, so {mode === 'wireframe' ? 'Wireframe' : 'Stick'} has
              nothing to draw. Switch to Ball &amp; Stick or Space-filling to see it.
            </Text>
          </View>
        )}

        <View style={styles.zoomColumn}>
          <Pressable
            onPress={() => viewerRef.current?.zoomBy(ZOOM_STEP)}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            style={styles.zoomButton}
          >
            <MaterialCommunityIcons name="plus" size={20} color={colors.text} importantForAccessibility="no" />
          </Pressable>
          <Pressable
            onPress={() => viewerRef.current?.zoomBy(1 / ZOOM_STEP)}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            style={styles.zoomButton}
          >
            <MaterialCommunityIcons name="minus" size={20} color={colors.text} importantForAccessibility="no" />
          </Pressable>
          <Pressable
            onPress={() => viewerRef.current?.resetView()}
            accessibilityRole="button"
            accessibilityLabel="Reset the view"
            style={styles.zoomButton}
          >
            <MaterialCommunityIcons
              name="image-filter-center-focus"
              size={18}
              color={colors.text}
              importantForAccessibility="no"
            />
          </Pressable>
        </View>

        {/* In landscape the viewer is short; the hint would sit on top of the
            molecule rather than under it. */}
        {!isLandscape && (
          <Text style={styles.hint} pointerEvents="none">
            {measureMode
              ? 'Tap 2 atoms for distance, 3 for angle'
              : 'Drag to rotate · pinch to zoom · double-tap an atom to center'}
          </Text>
        )}
      </View>

      {/* The stat cards are the first thing to go in landscape: they cost ~90dp
          of height that the 3D view needs far more than the atom count does. */}
      {!isLandscape && (
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
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
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
    // Landscape: the two control rows share one line, so neither claims the full
    // width and the viewer keeps the height it would otherwise lose.
    controlsLandscape: { flexDirection: 'row', alignItems: 'center' },
    modeRowLandscape: { flex: 1, marginBottom: 0, paddingRight: spacing(2) },
    toolRowLandscape: { marginBottom: 0, paddingLeft: 0 },
    viewerWrap: { flex: 1, marginHorizontal: spacing(4), borderRadius: radii.lg, overflow: 'hidden', position: 'relative' },
    zoomColumn: {
      position: 'absolute',
      right: spacing(3),
      top: spacing(3),
      gap: spacing(2),
    },
    zoomButton: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      // Same translucent panel treatment as the tooltip — always sits on top
      // of the 3D canvas, so it needs to read against either palette's canvas
      // background, not just one.
      backgroundColor: colors.tooltipBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyMode: {
      position: 'absolute',
      left: spacing(6),
      right: spacing(6),
      top: '40%',
      alignItems: 'center',
    },
    emptyModeText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      backgroundColor: colors.tooltipBg,
      borderRadius: radii.md,
      paddingHorizontal: spacing(4),
      paddingVertical: spacing(3),
    },
    hint: {
      position: 'absolute',
      bottom: spacing(3),
      alignSelf: 'center',
      ...typography.caption,
      color: colors.textFaint,
      backgroundColor: colors.tooltipBg,
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
