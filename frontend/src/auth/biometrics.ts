// Biometric gate (Face ID / Touch ID / Android biometrics) via expo-local-authentication.
// This authenticates the *device user*, not the server — the JWT stays in secure
// storage and biometrics simply re-opens access to it locally on each foreground event.
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCheck {
  available: boolean; // hardware present AND at least one biometric enrolled
  label: string; // "Face ID" / "Touch ID" / "Biometrics", for button copy
}

export async function checkBiometricSupport(): Promise<BiometricCheck> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
  if (!hasHardware || !isEnrolled) return { available: false, label: 'Biometrics' };

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'Touch ID'
      : 'Biometrics';

  return { available: true, label };
}

const ERROR_MESSAGES: Record<string, string> = {
  authentication_failed: 'Authentication failed. Please try again.',
  user_cancel: 'Authentication was cancelled.',
  system_cancel: 'Authentication was cancelled.',
  app_cancelled: 'Authentication was cancelled.',
  lockout: 'Too many failed attempts. Please use your password instead.',
  lockout_permanent: 'Biometrics locked. Please use your password instead.',
  not_enrolled: 'No biometrics enrolled on this device.',
  not_available: 'Biometric authentication is not available on this device.',
};

export interface BiometricResult {
  success: boolean;
  message?: string; // set when !success — user-facing, per protein.md's popup requirement
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<BiometricResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use password',
    disableDeviceFallback: true, // stay in our own UI on failure, don't fall to OS PIN
  });

  if (result.success) return { success: true };
  const message = ERROR_MESSAGES[result.error ?? ''] ?? 'Authentication failed. Please try again.';
  return { success: false, message };
}
