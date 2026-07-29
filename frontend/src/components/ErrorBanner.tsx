import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../theme/theme';

export function ErrorBanner({ message }: { message: string }) {
  return (
    // A banner appears without focus moving to it, so announce it.
    <View style={styles.banner} accessible accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={18}
        color={colors.danger}
        importantForAccessibility="no"
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.dangerBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(3.5),
    marginBottom: spacing(4),
  },
  text: { ...typography.body, color: colors.danger, flex: 1 },
});
