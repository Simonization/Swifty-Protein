// Settings (bonus VII.2).
//
// The server URL is the one that earns its keep: EXPO_PUBLIC_API_URL is baked in
// at build time and defaults to localhost, which on a phone means the phone
// itself. Being able to point the app at the evaluator's laptop at runtime is
// what makes a build usable anywhere but the machine that produced it.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { MoleculeBackdrop } from '../components/MoleculeBackdrop';
import { colors, radii, spacing, typography } from '../theme/theme';
import { useSettings } from '../settings/SettingsContext';
import { DEFAULT_SETTINGS, isValidApiUrl } from '../settings/settings';
import { VIEW_MODES } from '../data/viewModes';
import type { ViewMode } from '../components/MoleculeViewer';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, save } = useSettings();

  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [defaultMode, setDefaultMode] = useState<ViewMode>(settings.defaultMode);
  const [showLabelsByDefault, setShowLabels] = useState(settings.showLabelsByDefault);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const url = apiBaseUrl.trim();
    if (!isValidApiUrl(url)) {
      setError('Enter a full URL, e.g. http://192.168.1.20:3000');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await save({ apiBaseUrl: url, defaultMode, showLabelsByDefault });
      navigation.goBack();
    } catch {
      Alert.alert('Couldn’t save settings', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => {
    setApiBaseUrl(DEFAULT_SETTINGS.apiBaseUrl);
    setDefaultMode(DEFAULT_SETTINGS.defaultMode);
    setShowLabels(DEFAULT_SETTINGS.showLabelsByDefault);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <MoleculeBackdrop />

      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>Server</Text>
        <TextField
          label="Backend URL"
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          error={error ?? undefined}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.20:3000"
        />
        <Text style={styles.hint}>
          Use the machine’s LAN IP, not localhost — on a phone, localhost is the phone.
        </Text>

        <Text style={styles.sectionLabel}>Viewer</Text>
        <Text style={styles.fieldLabel}>Default view mode</Text>
        <View style={styles.modeGrid}>
          {VIEW_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setDefaultMode(m.key)}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} as the default view mode`}
              accessibilityState={{ selected: defaultMode === m.key }}
              style={[styles.modeChip, defaultMode === m.key && styles.modeChipActive]}
            >
              <Text style={[styles.modeLabel, defaultMode === m.key && styles.modeLabelActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.fieldLabel}>Show atom labels by default</Text>
            <Text style={styles.hint}>Labels can still be toggled per ligand.</Text>
          </View>
          <Switch
            value={showLabelsByDefault}
            onValueChange={setShowLabels}
            accessibilityLabel="Show atom labels by default"
            accessibilityHint="Labels can still be toggled per ligand"
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>

        <View style={styles.actions}>
          <Button label="Save" onPress={submit} loading={saving} />
          <Button label="Restore defaults" onPress={restoreDefaults} variant="ghost" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing(6), paddingTop: spacing(2) },
  sectionLabel: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    marginTop: spacing(4),
    marginBottom: spacing(2),
  },
  fieldLabel: { ...typography.label, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  modeChip: {
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeLabel: { ...typography.caption, color: colors.textMuted },
  modeLabelActive: { color: colors.bg, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(4),
    marginTop: spacing(5),
  },
  switchText: { flex: 1 },
  actions: { marginTop: spacing(8), gap: spacing(3) },
});
