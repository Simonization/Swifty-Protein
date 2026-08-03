// First-run tour (bonus VII.2 "Onboarding").
//
// Shown once, after the first successful unlock, and dismissed into
// `settings.onboardingSeen`. Three cards, because the app has exactly three
// things a newcomer cannot guess: where the data comes from, that the 3D view
// is touch-driven, and that opened ligands keep working offline.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { MoleculeBackdrop } from '../components/MoleculeBackdrop';
import { colors, radii, spacing, typography } from '../theme/theme';

interface Card {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}

const CARDS: Card[] = [
  {
    icon: 'database-search-outline',
    title: '1,243 ligands, live from RCSB',
    body: 'Search the Protein Data Bank by ligand code — ATP, HEM, ZN. Each one is fetched and parsed the moment you open it.',
  },
  {
    icon: 'rotate-3d-variant',
    title: 'The model is in your hands',
    body: 'Drag to rotate, pinch or use the +/− buttons to zoom, two fingers to pan. Tap any atom for its element, and double-tap to centre on it.',
  },
  {
    icon: 'cloud-check-outline',
    title: 'Works without a signal',
    body: 'Every ligand you open is cached on the device. Rows marked “Offline” open again with no connection at all.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const last = index === CARDS.length - 1;

  return (
    <SafeAreaView style={styles.fill}>
      <MoleculeBackdrop />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name={card.icon}
            size={44}
            color={colors.primary}
            importantForAccessibility="no"
          />
        </View>
        {/* Announced as one block: a screen reader should read the new card
            after the Next tap, not just the changed button label. */}
        <View accessible accessibilityLiveRegion="polite">
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.body_}>{card.body}</Text>
        </View>

        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${index + 1} of ${CARDS.length}`}
        >
          {CARDS.map((c, i) => (
            <View key={c.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={last ? 'Start exploring' : 'Next'}
            onPress={() => (last ? onDone() : setIndex((i) => i + 1))}
          />
          {!last && (
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Skip the introduction"
              style={styles.skip}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing(7) },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing(7),
  },
  title: { ...typography.display, fontSize: 24, color: colors.text, textAlign: 'center' },
  body_: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing(3),
    lineHeight: 22,
  },
  dots: { flexDirection: 'row', gap: spacing(2), justifyContent: 'center', marginTop: spacing(8) },
  dot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  actions: { marginTop: spacing(8), gap: spacing(2) },
  skip: { alignSelf: 'center', padding: spacing(3) },
  skipText: { ...typography.body, color: colors.textMuted },
});
