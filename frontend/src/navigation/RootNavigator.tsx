import { useEffect, useState } from 'react';
import { DarkTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LigandListScreen } from '../screens/LigandListScreen';
import { LigandViewScreen } from '../screens/LigandViewScreen';
import { colors } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import type { AuthStackParamList, AppStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const navTheme: NavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.primary },
};

const MIN_SPLASH_MS = 1200;

export function RootNavigator() {
  const { status } = useAuth();
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = status === 'bootstrapping' || !splashElapsed;

  return (
    <NavigationContainer theme={navTheme}>
      {showSplash ? (
        <SplashScreen />
      ) : status === 'unlocked' ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="LigandList" component={LigandListScreen} />
          <AppStack.Screen name="LigandView" component={LigandViewScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
