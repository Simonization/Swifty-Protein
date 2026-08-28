import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { radii, spacing, typography, type ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

export function ErrorBanner({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // A banner that just appears reads as a layout jump; fading and settling in
  // marks it as new information rather than something that was always there.
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [message, entrance]);

  const opacity = entrance;
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });

  return (
    // A banner appears without focus moving to it, so announce it.
    <Animated.View
      style={[styles.banner, { opacity, transform: [{ translateY }] }]}
      accessible
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={18}
        color={colors.danger}
        importantForAccessibility="no"
      />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
