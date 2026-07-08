// Dark "biotech lab" theme: deep navy/charcoal base, electric cyan primary accent,
// violet secondary accent (cyan -> violet gradients read as a DNA/molecule motif).
export const colors = {
  bg: '#0A0E17',
  bgElevated: '#0F1524',
  surface: '#141B2E',
  surfaceAlt: '#1B2438',
  border: '#26314A',

  primary: '#22D3EE',
  primaryDark: '#0EA5C4',
  accent: '#8B7CF6',

  text: '#E8EDF6',
  textMuted: '#8B96AE',
  textFaint: '#5A6480',

  success: '#34D399',
  danger: '#FB7185',
  dangerBg: 'rgba(251, 113, 133, 0.12)',

  overlay: 'rgba(4, 6, 12, 0.6)',
} as const;

export const gradients = {
  primary: [colors.primary, colors.accent] as const,
  background: ['#0A0E17', '#0D1220', '#0A0E17'] as const,
};

export const spacing = (n: number) => n * 4;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: 0.2 },
  title: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
};

export const theme = { colors, gradients, spacing, radii, typography };
export type Theme = typeof theme;
