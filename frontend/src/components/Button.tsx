import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, gradients, radii, typography } from '../theme/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon }: ButtonProps) {
  const isDisabled = disabled || loading;

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={({ pressed }) => [styles.ghost, pressed && styles.pressed, isDisabled && styles.disabled]}
      >
        {loading ? <ActivityIndicator color={colors.text} /> : (
          <View style={styles.content}>
            {icon}
            <Text style={styles.ghostLabel}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [pressed && styles.pressed, isDisabled && styles.disabled]}
    >
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
        {loading ? <ActivityIndicator color={colors.bg} /> : (
          <View style={styles.content}>
            {icon}
            <Text style={styles.primaryLabel}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { ...typography.title, fontSize: 16, color: colors.bg },
  ghost: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostLabel: { ...typography.title, fontSize: 16, color: colors.text },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
