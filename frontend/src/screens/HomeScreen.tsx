import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';

// Placeholder landing screen — the ligand list + 3D viewer land here next.
export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="molecule" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>You're in, {user?.username}</Text>
        <Text style={styles.subtitle}>The ligand list and 3D viewer land here next.</Text>
        <View style={styles.gap} />
        <Button label="Log out" variant="ghost" onPress={() => logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(5),
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing(2) },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing(6) },
  gap: { height: spacing(8) },
});
