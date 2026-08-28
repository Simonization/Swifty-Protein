// Last line of defence for the subject's "crashes, freezes, or unexpected
// behaviour are unacceptable" rule. A render-time throw anywhere below this —
// most plausibly inside the three.js viewer, which runs untrusted geometry from
// a remote file — otherwise becomes a red box in dev and a blank screen in a
// release build. Here it becomes a message with a way out.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from './Button';
import { spacing, typography, darkColors, type ThemeColors } from '../theme/theme';
import { ThemeContext, type ThemeContextValue } from '../theme/ThemeContext';

interface Props {
  children: ReactNode;
  // Bumping this resets the boundary — the navigator passes the current route so
  // that navigating away from a screen that threw clears the error.
  resetKey?: string | number;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // A class component can't call useTheme(), so it reads the same context
  // directly — the one case in the app that needs the raw context object
  // rather than the hook. No `declare context: ...` field: Expo's Metro/Babel
  // pipeline strips Flow types without `allowDeclareFields`, so that field
  // modifier is a build error there even though tsc and Jest (ts-jest/babel
  // configured differently) both accept it — caught by actually running the
  // app, not by either checker. Read via `this.context` and cast at the one
  // call site instead.
  static contextType = ThemeContext;

  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Dev-only: in a release build this is the difference between a silent
    // recovery and a report nobody can act on, but it must never ship a
    // console channel that could carry user data.
    if (__DEV__) console.error('Unhandled render error', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Falls back to the dark palette if somehow rendered outside a
    // ThemeProvider — never actually happens (App.tsx always wraps it), but a
    // boundary that could itself throw on a missing theme would defeat the point.
    const colors = (this.context as ThemeContextValue | undefined)?.colors ?? darkColors;
    const styles = makeStyles(colors);

    return (
      <View style={styles.root} accessible accessibilityRole="alert">
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={colors.danger}
          importantForAccessibility="no"
        />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error and stopped what it was doing. Nothing was lost — you can
          carry on from here.
        </Text>
        {__DEV__ && <Text style={styles.detail}>{error.message}</Text>}
        <View style={styles.gap} />
        <Button label="Try again" onPress={this.reset} />
      </View>
    );
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(6),
    },
    title: { ...typography.title, color: colors.text, marginTop: spacing(4), textAlign: 'center' },
    body: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing(2),
    },
    detail: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
      marginTop: spacing(3),
    },
    gap: { height: spacing(6) },
  });
