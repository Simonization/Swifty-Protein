import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { spacing, typography, type ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { useAuth, describeAuthError } from '../auth/AuthContext';
import { validatePassword, validateUsername } from '../auth/credentials';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { status, user, biometrics, loginWithPassword, unlockWithBiometrics, logout } = useAuth();
  const locked = status === 'locked';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(!biometrics.available);

  // Reset transient form state on every status change so a stale password/error
  // from a previous session (e.g. right after logging out) never lingers.
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError(null);
    setShowPasswordFallback(!biometrics.available);
  }, [status, biometrics.available]);

  // Shared by the auto-prompt below and the "Unlock" button. `unlockWithBiometrics`
  // resolves rather than rejects on a failed scan, but a rejection here would be an
  // unhandled promise on the one screen the subject requires to always work.
  const promptBiometrics = async () => {
    try {
      const result = await unlockWithBiometrics();
      if (!result.success && result.message) {
        Alert.alert('Authentication failed', result.message);
      }
    } catch {
      Alert.alert('Authentication failed', 'Authentication failed. Please try again.');
    }
  };

  // In the locked (re-auth) state, offer the device's biometric prompt immediately.
  useEffect(() => {
    if (locked && biometrics.available && !showPasswordFallback) {
      void promptBiometrics();
    }
    // Only run once when this screen mounts into the locked state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const effectiveUsername = locked ? user?.username ?? '' : username;

  const validate = (): string | null =>
    validateUsername(effectiveUsername) ?? validatePassword(password);

  const submit = async () => {
    setError(null);
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(effectiveUsername.trim(), password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // clearSession() swallows its own storage errors, so this cannot reject; `void`
  // documents that the button deliberately does not await it.
  const handleLogout = () => {
    void logout();
  };

  if (locked && !showPasswordFallback) {
    return (
      <Screen scroll={false}>
        <Logo size={64} />
        <Text style={styles.welcomeBack}>Welcome back, {user?.username}</Text>
        <Text style={styles.subtitle}>Unlock with {biometrics.label} to continue.</Text>
        <View style={styles.gap} />
        <Button label={`Unlock with ${biometrics.label}`} onPress={() => void promptBiometrics()} />
        <View style={styles.smallGap} />
        <Button label="Use password instead" variant="ghost" onPress={() => setShowPasswordFallback(true)} />
        <View style={styles.smallGap} />
        <Button label="Log out" variant="ghost" onPress={handleLogout} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Logo />
      {locked && <Text style={styles.welcomeBack}>Welcome back, {user?.username}</Text>}
      {error && <ErrorBanner message={error} />}
      <TextField
        label="Username"
        placeholder="e.g. rodolfo"
        autoCapitalize="none"
        autoCorrect={false}
        value={effectiveUsername}
        onChangeText={setUsername}
        editable={!locked}
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secure
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.smallGap} />
      <Button label={locked ? 'Unlock' : 'Log In'} onPress={submit} loading={loading} />
      {locked && biometrics.available && (
        <>
          <View style={styles.smallGap} />
          <Button label={`Use ${biometrics.label} instead`} variant="ghost" onPress={() => setShowPasswordFallback(false)} />
        </>
      )}
      <View style={styles.smallGap} />
      {locked ? (
        <Button label="Log out" variant="ghost" onPress={handleLogout} />
      ) : (
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
            Create an account
          </Text>
        </View>
      )}
      {/* The way out of the deadlock: the app talks to a backend on someone
          else's machine, and until that address is right nothing here can
          succeed -- including reaching Settings, if it lived behind the login. */}
      <View style={styles.footerRow}>
        <Text
          style={styles.serverLink}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Can’t connect? Set the server address"
        >
          Can’t connect? Set the server address
        </Text>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    welcomeBack: { ...typography.title, color: colors.text, textAlign: 'center', marginBottom: spacing(2) },
    subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    gap: { height: spacing(10) },
    smallGap: { height: spacing(3) },
    footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(2) },
    footerText: { ...typography.body, color: colors.textMuted },
    link: { ...typography.body, color: colors.primary, fontWeight: '700' },
    serverLink: { ...typography.body, color: colors.textMuted, marginTop: spacing(1), textDecorationLine: 'underline' },
  });
