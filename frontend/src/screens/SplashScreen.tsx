import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { spacing, typography, type ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

export function SplashScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.9, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <Animated.View style={[styles.orbit, { transform: [{ rotate }, { scale: pulse }] }]}>
          <MaterialCommunityIcons name="atom" size={72} color={colors.primary} />
        </Animated.View>
        <Text style={styles.wordmark}>SWIFTY PROTEIN</Text>
        <Text style={styles.tagline}>Loading secure session…</Text>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    orbit: { marginBottom: spacing(6) },
    wordmark: { ...typography.display, color: colors.text, letterSpacing: 3 },
    tagline: { ...typography.caption, color: colors.textMuted, marginTop: spacing(2) },
  });
