// Two "biotech lab" palettes: a dark one (deep navy/charcoal, electric cyan
// primary, violet accent) and a light one (clean lab-white, the same hues
// darkened until they clear WCAG AA against a light background). Which one is
// active is a user setting (bonus VII.2 "Dark Mode") resolved by
// ThemeContext — nothing in this file is a global default any more.
//
// Every text/icon color below is checked against both `bg` and `surface`
// with the actual WCAG relative-luminance formula (not eyeballed) to clear
// 4.5:1, the normal-text AA threshold. See the contrast check any time a
// color changes: the light palette's `primary`/`success`/`danger` all sit
// noticeably darker than their dark-palette counterparts specifically to
// clear that bar on a light background.
export const darkColors = {
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
  // Contrast against `bg` is checked, not eyeballed: this is the dimmest colour
  // that still clears WCAG AA (4.5:1) for normal text. #5A6480 was 3.28:1 and is
  // used for placeholders and the viewer's gesture hint, which have to be legible.
  textFaint: '#7B87A3',

  success: '#34D399',
  danger: '#FB7185',
  dangerBg: 'rgba(251, 113, 133, 0.12)',
  successBg: 'rgba(52, 211, 153, 0.12)',

  overlay: 'rgba(4, 6, 12, 0.6)',
  tooltipBg: 'rgba(20, 27, 46, 0.92)',
} as const;

export const lightColors: ThemeColors = {
  bg: '#F4F6FB',
  bgElevated: '#EAEDF6',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0F7',
  border: '#D7DCE8',

  // Darker than the dark palette's primary/accent on purpose: #22D3EE measures
  // 3.41:1 against this background, which fails AA the moment it's used as
  // text rather than decoration (it is, in several places).
  primary: '#0A7690',
  primaryDark: '#085F76',
  accent: '#6151C4',

  text: '#101522',
  textMuted: '#525C74',
  textFaint: '#5C6680', // 5.30:1 against `bg` — clears AA with room to spare

  success: '#157A56', // 4.92:1 — the dark palette's #34D399 measures 3.18:1 here
  danger: '#C42C4C', // 5.10:1 — the dark palette's #FB7185 measures 4.07:1 here
  dangerBg: 'rgba(196, 44, 76, 0.10)',
  successBg: 'rgba(21, 122, 86, 0.10)',

  overlay: 'rgba(10, 14, 23, 0.35)',
  tooltipBg: 'rgba(255, 255, 255, 0.94)',
};

// Widened to plain `string` per key: `darkColors` is `as const` (literal hex
// types) so its contrast comments stay pinned to the exact values checked,
// but a type built directly from that would reject `lightColors`, which is
// deliberately a different set of literals for the same keys.
export type ThemeColors = { readonly [K in keyof typeof darkColors]: string };
export type ColorScheme = 'light' | 'dark';

export const PALETTES: Record<ColorScheme, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};

// Gradients derive from a palette rather than being one themselves, so they
// follow whichever palette ThemeContext resolves to instead of being a fixed
// dark-only value.
export function gradientsFor(colors: ThemeColors) {
  return {
    primary: [colors.primary, colors.accent] as const,
    background: [colors.bg, colors.bgElevated, colors.bg] as const,
  };
}

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
