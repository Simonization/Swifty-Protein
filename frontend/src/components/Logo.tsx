import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../theme/theme';

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel="Swifty Protein — molecular structure visualizer">
      <View
        style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialCommunityIcons name="atom" size={size * 0.6} color={colors.primary} />
      </View>
      <Text style={styles.wordmark}>SWIFTY PROTEIN</Text>
      <Text style={styles.tagline}>Molecular structure visualizer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing(8) },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  wordmark: { ...typography.title, color: colors.text, letterSpacing: 2 },
  tagline: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
});
