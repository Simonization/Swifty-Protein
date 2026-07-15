import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, spacing, typography } from '../theme/theme';
import { useAuth, describeAuthError } from '../auth/AuthContext';
import { validatePassword, validateUsername } from '../auth/credentials';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    const invalid = validateUsername(username) ?? validatePassword(password);
    if (invalid) return invalid;
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  };

  const submit = async () => {
    setError(null);
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Logo />
      {error && <ErrorBanner message={error} />}
      <TextField
        label="Username"
        placeholder="3-32 characters"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextField label="Password" placeholder="At least 8 characters" secure value={password} onChangeText={setPassword} />
      <TextField label="Confirm password" placeholder="Repeat your password" secure value={confirm} onChangeText={setConfirm} />
      <View style={styles.smallGap} />
      <Button label="Create Account" onPress={submit} loading={loading} />
      <View style={styles.smallGap} />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
          Log in
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  smallGap: { height: spacing(3) },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(2) },
  footerText: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary, fontWeight: '700' },
});
