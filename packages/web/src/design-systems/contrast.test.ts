import { describe, expect, it } from 'vitest';
import { contrastFor, contrastRatio, parseColor, relativeLuminance } from './contrast';
import { A11Y_INVARIANTS } from './a11y';

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#0a0a0a')).toEqual({ r: 10, g: 10, b: 10 });
  });
  it('parses #rgb', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('parses hsl(h s% l%)', () => {
    const rgb = parseColor('hsl(0 0% 100%)');
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('parses hsl(h s% l% / α)', () => {
    const rgb = parseColor('hsl(220 18% 14% / 0.5)');
    expect(rgb && rgb.r < 60 && rgb.g < 60 && rgb.b < 60).toBe(true);
  });
  it('parses rgb(r g b)', () => {
    expect(parseColor('rgb(255 100 0)')).toEqual({ r: 255, g: 100, b: 0 });
  });
  it('falls back to first inner color for color-mix', () => {
    const rgb = parseColor('color-mix(in srgb, hsl(0 0% 0%) 12%, hsl(0 0% 100%))');
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('returns null for unknown formats', () => {
    expect(parseColor('lab(50% 0 0)')).toBeNull();
  });
});

describe('luminance & contrast', () => {
  it('white→black contrast is 21', () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 1);
  });
  it('white→white contrast is 1', () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 })).toBe(1);
  });
  it('relative luminance is 0 for black, 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
  });
});

/* Documented token pairs the redesign body copy must clear. */

const LIGHT_PAIRS: Array<{ fg: string; bg: string; min: number; label: string }> = [
  {
    fg: 'hsl(220 18% 14%)', // --color-foreground (light)
    bg: 'hsl(0 0% 100%)', // --color-background (light)
    min: A11Y_INVARIANTS.bodyContrastRatio,
    label: 'foreground on background',
  },
  {
    fg: 'hsl(220 18% 14%)',
    bg: 'hsl(220 16% 98%)', // --color-surface
    min: A11Y_INVARIANTS.bodyContrastRatio,
    label: 'foreground on surface',
  },
  {
    fg: 'hsl(220 10% 44%)', // --color-muted-foreground
    bg: 'hsl(0 0% 100%)',
    min: A11Y_INVARIANTS.largeContrastRatio,
    label: 'muted-foreground on background (large/AA-large)',
  },
  {
    fg: 'hsl(0 0% 100%)', // --color-accent-foreground
    bg: 'hsl(214 88% 50%)', // --color-accent
    min: A11Y_INVARIANTS.bodyContrastRatio,
    label: 'accent-foreground on accent',
  },
];

const DARK_PAIRS: Array<{ fg: string; bg: string; min: number; label: string }> = [
  {
    fg: 'hsl(220 14% 92%)', // --color-foreground (dark)
    bg: 'hsl(220 14% 10%)', // --color-background (dark)
    min: A11Y_INVARIANTS.bodyContrastRatio,
    label: 'dark foreground on background',
  },
  {
    fg: 'hsl(220 14% 92%)',
    bg: 'hsl(220 12% 13%)', // --color-surface (dark)
    min: A11Y_INVARIANTS.bodyContrastRatio,
    label: 'dark foreground on surface',
  },
  {
    fg: 'hsl(220 10% 62%)', // dark --color-muted-foreground
    bg: 'hsl(220 14% 10%)',
    min: A11Y_INVARIANTS.largeContrastRatio,
    label: 'dark muted-foreground on background (AA-large)',
  },
];

describe('WCAG contrast — light theme tokens (§22)', () => {
  for (const pair of LIGHT_PAIRS) {
    it(`${pair.label} ≥ ${pair.min}:1`, () => {
      const c = contrastFor(pair.fg, pair.bg);
      expect(c, `parseColor failed for ${pair.fg} on ${pair.bg}`).not.toBeNull();
      expect(c!).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

describe('WCAG contrast — dark theme tokens (§22)', () => {
  for (const pair of DARK_PAIRS) {
    it(`${pair.label} ≥ ${pair.min}:1`, () => {
      const c = contrastFor(pair.fg, pair.bg);
      expect(c, `parseColor failed for ${pair.fg} on ${pair.bg}`).not.toBeNull();
      expect(c!).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
