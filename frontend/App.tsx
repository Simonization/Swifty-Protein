import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthContext';
import { SettingsProvider } from './src/settings/SettingsContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// A plain function component so it can call useTheme() — the status bar's
// icon color has to flip with the palette, or a light theme ends up with
// light system-icons on a light background.
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Outermost boundary. The viewer has its own (LigandViewScreen) so a GL
            failure only takes out the canvas; this one catches everything else. */}
        <ErrorBoundary>
          {/* Settings wraps everything else: the persisted server URL has to be
              applied to the API client before anything tries to log in, and the
              persisted theme has to be resolved before anything renders. */}
          <SettingsProvider>
            <ThemeProvider>
              <AuthProvider>
                <ThemedStatusBar />
                <RootNavigator />
              </AuthProvider>
            </ThemeProvider>
          </SettingsProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
