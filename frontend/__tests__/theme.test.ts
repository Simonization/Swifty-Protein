// The dark palette's textFaint was already documented as "checked, not
// eyeballed" against WCAG AA (4.5:1). This test makes that a real,
// re-checked guarantee for both palettes, on every text-bearing color, not
// just the one that happened to be closest to the line when someone looked.
import { darkColors, lightColors, type ThemeColors } from '../src/theme/theme';

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Colors actually used as text/icon foreground somewhere in the app, checked
// against every background they're known to sit on. `border` and the *Bg
// tokens are backgrounds/dividers, never text, so they're excluded.
const TEXT_KEYS: (keyof ThemeColors)[] = ['text', 'textMuted', 'textFaint', 'primary', 'accent', 'success', 'danger'];
const AA_NORMAL_TEXT = 4.5;

describe.each([
  ['dark', darkColors],
  ['light', lightColors],
])('%s palette contrast', (_name, palette) => {
  it.each(TEXT_KEYS)('%s clears WCAG AA (4.5:1) against bg', (key) => {
    expect(contrast(palette[key], palette.bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(TEXT_KEYS)('%s clears WCAG AA (4.5:1) against surface', (key) => {
    expect(contrast(palette[key], palette.surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe('palette shape parity', () => {
  it('the light palette defines exactly the same keys as the dark one', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
  });
});
